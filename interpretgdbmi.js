
function prompt() {
  console.log('(gdb)');
}

function formatItem(obj) {
  if (typeof obj === 'string') {
    return JSON.stringify(obj);
  }
  if (typeof obj === 'number') {
    return obj + '';
  }
  if (Array.isArray(obj)) {
    return '[' + Array.prototype.map.call(obj, formatItem).join(',') + ']';
  }
  return '{' + formatResult(obj) + '}';
}

function formatResult(obj) {
  var s = [];
  for (var i in obj) {
    s.push(i + '=' + formatItem(obj[i]));
  }
  return s.join(',');
}

function asyncOutput(prefix, cls, result) {
  var resultStr = result !== undefined ? ',' + formatResult(result) : '';
  console.log(prefix + cls + resultStr);
}

function execAsyncOutput(prefix, cls, result) {
  asyncOutput(prefix + '*', cls, result);
}

function notifyAsyncOutput(prefix, cls, result) {
  asyncOutput(prefix + '=', cls, result);
}

function resultRecord(prefix, cls, result) {
  var s = prefix + '^' + cls;
  if (result !== undefined) {
    s += ',' + formatResult(result);
  }
  console.log(s);
}

function consoleStreamOutput(str) {
  console.log('~' + formatItem(str));
}

function done(prefix, result) {
  resultRecord(prefix, 'done', result);
}

function executeCommand(cmd, token, state) {
  var prefix = token < 0 ? '' : '' + token;
  if (typeof cmd === 'string') {
    console.log(prefix + '^error,msg="Unsupported CLI command"');
    prompt();
    return;
  }
  switch (cmd.operation) {
    case '-list-features':
      done(prefix, {
        features:["frozen-varobjs","pending-breakpoints","thread-info","data-read-memory-bytes","breakpoint-notifications","ada-task-info","language-option","info-gdb-mi-command","undefined-command-error-code","exec-run-start-option","python"]
      });
      break;
    case '-gdb-version':
      console.log('~' + formatItem("GNU gdb (Fake) 7.7.1\n"));
      done(prefix);
      break;
    case '-environment-cd':
      state.environmentPath = cmd.parameters[0];
      done(prefix);
      break;
    case '-gdb-set':
    case '-inferior-tty-set':
    case '-enable-pretty-printing':
      done(prefix);
      break;
    case '-file-exec-and-symbols':
      state.moduleRunning = cmd.parameters[0];
      done(prefix);
      break;
    case '-gdb-show':
      var value = 'auto';
      done(prefix, {value: value});
      break;
    case '-interpreter-exec':
      var expr = cmd.parameters[1];
      switch (expr) {
        case "p/x (char)-1":
          consoleStreamOutput("$1 = 0xff\n");
          break;
        case "show endian":
          consoleStreamOutput("The target endianness is set automatically (currently little endian)\n");
          break;
        case "kill":
          consoleStreamOutput("Kill the program being debugger? (y or n) [answered Y; input not from terminal]\n");
          notifyAsyncOutput('', 'thread-exited', {id: "1", "group-id": state.threadGroup});
          notifyAsyncOutput('', 'thread-group-exited', {id: state.threadGroup});
          break;
      }
      done(prefix);
      break;
    case '-data-evaluate-expression':
      var expr = cmd.parameters[0];
      switch (expr) {
        case "sizeof (void*)":
          done(prefix, {value: "8"});
          break;
      }
      break;
    case '-list-thread-groups':
      if (cmd.parameters.length > 0) {
        var groupId = cmd.parameters[0];
        if (groupId === state.threadGroup) {
          done(prefix, {
            threads: [
              {
                id: "1", "target-id": "process " + state.targetPID, name: "test1",
                frame: {
                  level: "0",
                  addr: "0x00000000004008a5",
                  func: "main",
                  args: [],
                  file: "js/test.js",
                  fullname: state.environmentPath + "/js/test.js",
                  line: "5"
                }, state: "stopped", core: "3"
              }]
          });
        }
        break;
      }
      if (cmd.options.length > 1 && cmd.options[0].name === '--available') {
        done(prefix, {
          groups: [{id: state.targetPID, type: "process", executable: state.moduleRunning}]
        });
        break;
      }
      done(prefix, {
        groups: [{
          id: state.threadGroup,
          type: "process",
          pid: state.targetPID,
          executable: state.moduleRunning
        }]
      });
      break;
    case '-break-insert':
      done(prefix, {
        bkpt: {
          number: "1",
          type: "breakpoint",
          disp: "del",
          enabled: "y",
          addr: "0x00000000004008a5",
          func: "main()",
          file: "js/test.js",
          fullname: state.environmentPath + "/js/test.js",
          line: "5",
          "thread-groups": [state.threadGroup],
          times: "0",
          "original-location": "main"
        }
      });
      break;
    case '-stack-list-locals':
      done(prefix, {locals: [{name: "i", value:"0"}]});
      break;
    case '-var-create':
      done(prefix, {name: "i", numchild:"0",value:"0", type: "int", "thread-id": "1", has_more: "0"});
      break;
    case '-exec-run':
    case '-exec-next':
    case '-exec-continue':
      notifyAsyncOutput('', 'thread-group-started', {id: state.threadGroup, pid: state.targetPID});
      notifyAsyncOutput('', 'thread-created', {id: "1", "group-id": state.threadGroup});
      resultRecord(prefix, 'running');
      asyncOutput('*', 'running', {"thread-id": "all"});
      var stopReason = cmd.operation === '-exec-next' ? "end-stepping-range" : "breakpoint-hit";
      if (cmd.operation === '-exec-run') {
        setTimeout(function () {
          asyncOutput('=', 'breakpoint-modified', {
            bkpt: {
              number: "1",
              type: "breakpoint",
              disp: "del",
              enabled: "y",
              addr: "0x00000000004008a5",
              func: "main()",
              file: "js/test.js",
              fullname: state.environmentPath + "/js/test.js",
              line: "5",
              "thread-groups": [state.threadGroup],
              times: "0",
              "original-location": "main"
            }
          });
        }, 20);
      }
      setTimeout(function () {
        asyncOutput('*', 'stopped', {
          reason: stopReason, disp: "del", bkptno: "1",
          frame: {
            addr: "0x00000000004008a5",
            func: "main",
            args: [],
            file: "js/test.js",
            fullname: state.environmentPath + "/js/test.js",
            line: "5"
          },
          "thread-id": "1", "stopped-threads": "all", core: "3"
        });
        prompt();
      }, 200);
      break;
    case '-stack-info-depth':
      done(prefix, {depth: "1"});
      break;
    case '-thread-info':
      done(prefix, {
        groups: [{
          id: state.threadGroup, type: "process", pid: state.targetPID,
          executable: state.moduleRunning, cores: ["7"]
        }]
      });
      break;
    case '-gdb-exit':
      resultRecord(prefix, 'exit');
      process.exit(0);
      break;
  }
  prompt();
}

function FakeGDBMI() {
  this.state = {
    threadGroup: 'i1',
    targetPID: '4906',
    moduleRunning: null,
    breakpoints: [],
    environmentPath: '.'
  };
}
FakeGDBMI.prototype = {
  start: function () {
    notifyAsyncOutput('', 'thread-group-added', {id: this.state.threadGroup});
    consoleStreamOutput('GNU gdb (Fake) 7.7.1\n');
    prompt();
  },
  executeCommand: function (cmd, token) {
    executeCommand(cmd, token, this.state);
  }
};

exports.FakeGDBMI = FakeGDBMI;