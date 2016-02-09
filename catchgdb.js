#!/opt/local/bin/node

// Utility to intercept GDB MI traffic

var fs = require('fs');
var path = require('path');
var spawn = require('child_process').spawn;

var useGDB = false;
var logfileName = 'log2.txt';

var executablePath;
var args = Array.prototype.slice.call(process.argv, 2);
if (useGDB) {
  executablePath = 'gdb';
  // args = args;
} else {
  var parsegdbmi = path.join(__dirname, 'parsegdbmi.js');
  executablePath = '/opt/local/bin/node';
  args.unshift(parsegdbmi);
}

var logfile = path.join(__dirname, logfileName);
var p = spawn(executablePath, args);

p.stdout.on('data', function (data) {
  fs.appendFileSync(logfile, '<~~' + data);
  process.stdout.write(data);
});
process.stdin.resume();
process.stdin.on('data', function(data) { 
  fs.appendFileSync(logfile, '~~>' + data);
  p.stdin.write(data);
});
process.stdin.on('end', function () {
  p.stdin.end();
});
process.stdout.on('error', function(err) {
  if (err.code === 'EPIPE') return process.exit();
  process.emit('error', err)
});

p.on('exit', function (c) {
  process.exit(c);
});