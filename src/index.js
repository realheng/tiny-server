const http = require('http')
const path = require('path')
const fs = require('fs')
const fsPromises = fs.promises
const ejs = require('ejs')
const chalk = require('chalk')
const url = require('url')
const mime = require('mime')
const crypto = require('crypto')
class TinyServer {
  constructor (options) {
    this.port = options.port
    this.directory = options.directory
    this.template = fs.readFileSync(
      path.join(__dirname, 'template', 'render.html'),
      'utf8'
    )
  }

  async handle (req, res) {
    let { pathname } = url.parse(req.url, true)
    // 可能其中包含中文,需要将中文解码
    pathname = decodeURIComponent(pathname)
    const filepath = path.join(this.directory, pathname)
    try {
      const statObj = await fsPromises.stat(filepath)
      if (statObj.isFile()) {
        // 如果是文件,那么就直接发送
        this.sendFile(req, res, statObj, filepath)
      } else {
        let dirs = await fsPromises.readdir(filepath)
        dirs = dirs.map(dir => ({
          dir,
          href: path.join(pathname, dir)
        }))
        const html = await ejs.render(this.template, { dirs }, { async: true })
        res.setHeader('Content-Type', 'text/html;charset=utf8')
        res.end(html)
      }
    } catch (error) {
      // 说明路径不存在
      this.sendError(req, res, error)
    }
  }

  cache (req, res, statObj, filepath) {
    // 无论是否过期都加上这个
    res.setHeader('Expires', new Date(Date.now() + 10 * 1000).toGMTString())
    // res.setHeader('Cache-Control', 'max-age=2000,public')
    res.setHeader('Cache-Control', 'max-age=5')
    // 协商缓存
    const ims = req.headers['if-modified-since']
    const ctime = statObj.ctime.toGMTString()
    const inm = req.headers['if-none-match']
    const etag = crypto
      .createHash('md5')
      .update(fs.readFileSync(filepath))
      .digest('base64')

    // 无论协商缓存是否成功,都设置一遍响应头.
    res.setHeader('Last-Modified', ctime)
    res.setHeader('Etag', etag)

    // 协商缓存失败
    // '||'运算符有先后顺序,且两个都失败不会执行
    if (ims !== ctime) {
      return false
    }

    if (inm !== etag) {
      return false
    }

    return true
  }

  sendFile (req, res, statObj, filepath) {
    if (this.cache(req, res, statObj, filepath)) {
      // 如果缓存新鲜,那么就直接返回304让浏览器读取缓存即可
      res.statusCode = 304
      return res.end()
    }
    res.setHeader('Content-Type', mime.getType(filepath) + ';charset=utf8')
    fs.createReadStream(filepath).pipe(res)
  }

  sendError (req, res, error) {
    console.log(error)
    res.statusCode = 404
    res.end(`Not Found`)
  }

  start () {
    const server = http.createServer(this.handle.bind(this))
    server.listen(this.port, () => {
      console.log(
        `${chalk.yellow('Starting up tiny-server: ')} ./${path.relative(
          process.cwd(),
          this.directory
        )}`
      )

      console.log(`http://localhost:${chalk.green(this.port)}`)
    })
  }
}

module.exports = TinyServer
