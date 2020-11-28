#! /usr/bin/env node

const program = require('commander')
const config = require('./serverConfig')
const { forEachObj } = require('../utils.js')
program.name('zs')
forEachObj(config, val => {
  program.option(val.option, val.descriptor)
})

// 发布订阅 用户调用--help时会触发此函数
program.on('--help', function () {
  console.log('\r\nExamples:')
  forEachObj(config, val => {
    console.log('  ' + val.usage)
  })
})

program.parse(process.argv)
const finalConfig = {}
forEachObj(config, (value, key) => {
  finalConfig[key] = program[key] || value.default
})

console.log(finalConfig);
const Server = require('../src')
let server = new Server(finalConfig)
server.start()
