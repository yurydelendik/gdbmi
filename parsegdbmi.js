if (process.argv[2] === '--version') {
  console.log('GNU gdb (Fake) 7.7.1');
  process.exit(1);
}

// Simalates GDB MI interface

var interpretgdbmi = require('./interpretgdbmi.js');

var buffer = new Buffer(0);

function Tokenizer(data) {
  this.data = data;
  this.pos = 0;
}
Tokenizer.prototype = {
  readToken: function () {
    if (this.pos >= this.data.length) {
      return null;
    }
    while (this.data[this.pos] === ' ') {
      this.pos++;
      if (this.pos >= this.data.length) {
        return null;
      }
    }
    var i = this.pos;
    var s = '';
    while (this.pos < this.data.length && this.data[this.pos] !== ' ') {
      if (this.data[this.pos] === '"') {
        var j = this.pos;
        do {
          if (this.data[this.pos] === '\\') {
            this.pos++;
          }
          this.pos++;
        } while (this.pos < this.data.length && this.data[this.pos] !== '"');
        this.pos++;
        s += JSON.parse(this.data.substring(j, this.pos));
      } else {
        s += this.data[this.pos++];
      }
    }
    return {text: s, start: i, end: this.pos};
  }
};

function parseCommand(buffer, pos) {
  var i = pos;
  while (i < buffer.length && buffer[i] >= 48 && buffer[i] <= 57) {
    i++;
  }
  var j = i;
  while (i < buffer.length && buffer[i] !== 10 && buffer[i] !== 13) {
    i++;
  }
  if (i === buffer.length) {
    return null;
  }
  var token = pos < j ? +buffer.slice(pos, j).toString() : -1;
  var lastPos = buffer[i] === 13 && buffer[i + 1] === 10 ? i + 2 : i + 1;
  var data = buffer.slice(j, i).toString();
  if (data[0] !== '-') {
    return {lastPos: lastPos, token: token, cmd: data };
  }
  
  var t, tk = new Tokenizer(data);
  t = tk.readToken();
  if (!t) {
    return null;
  }
  var miCommand = {
    operation: t.text,
    options: [],
    parameters: []
  };
  
  t = tk.readToken();
  while (t && t.text[0] === '-') {
    if (t.text === '--') {
      t = tk.readToken();
      break;
    }
    var optionName = t.text, optionValue;
    t = tk.readToken();
    if (t && t.text[0] !== '-') {
      optionValue = t.text;
      t = tk.readToken();
    }
    miCommand.options.push({name: optionName, value: optionValue});
  }

  while (t) {
    miCommand.parameters.push(t.text);
    t = tk.readToken();
  } 

  return {lastPos: lastPos, token: token, cmd: miCommand };
}

process.stdin.resume();
process.stdin.on('data', function(data) {
  var newBuffer = Buffer.concat([buffer, data], buffer.length + data.length);
  var pos = 0, parseResult;
  while (pos < newBuffer.length && (parseResult = parseCommand(newBuffer, pos))) {
    interpreter.executeCommand(parseResult.cmd, parseResult.token);
    pos = parseResult.lastPos;
  }
  if (pos < newBuffer.length) {
    buffer = newBuffer.slice(pos);
  } else if (buffer.length > 0) {
    buffer = new Buffer(0);
  }
});
process.stdin.on('end', function () {
});

process.stdout.on('error', function(err) {
  if (err.code === 'EPIPE') return process.exit();
  process.emit('error', err)
});


var interpreter = new interpretgdbmi.FakeGDBMI();
interpreter.start();