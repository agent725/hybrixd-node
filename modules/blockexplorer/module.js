// (C) 2015 Internet of Coins / Metasync / Joachim de Koning
// hybrixd module - blockexplorer/module.js
// Module to connect to Block explorers

// Supported block explorer systems and their API's:
//  Insight:            https://blockexplorer.com/api-ref
//  Blockr:             http://blockr.io/documentation/api  NB blockr has been depreciated, left here for reference
//  ABE (open source):  http://explorer.litecoin.net/q

// required libraries in this context
let Client = require('../../lib/rest').Client;
let APIqueue = require('../../lib/APIqueue');
let scheduler = require('../../lib/scheduler');
let modules = require('../../lib/modules');
let functions = require('../../lib/functions');

let jstr = function (data) { return JSON.stringify(data); };

// exports
exports.init = init;
exports.tick = tick;
exports.exec = exec;
exports.stop = stop;
exports.link = link;
exports.post = post;

// initialization function
function init () {
  modules.initexec('blockexplorer', ['init']);
}

// stop function
function stop () {
}

// loop tick called by internal scheduler
function tick (properties) {
}

// standard functions of an asset store results in a process superglobal -> global.hybrixd.process[processID]
// child processes are waited on, and the parent process is then updated by the postprocess() function
// standard functions of an asset store results in a process superglobal -> global.hybrixd.process[processID]
// child processes are waited on, and the parent process is then updated by the postprocess() function
// http://docs.electrum.org/en/latest/protocol.html
function exec (properties) {
  /*
    command paths:

    /source/blockexplorer/init -> init
    /source/blockexplorer/$SYMBOL/balance -> $SYMBOL/balance
    /source/blockexplorer/$SYMBOL/unspents -> $SYMBOL/balance

  */
  var command = properties.command;
  let processID = properties.processID;

  let subprocesses = [];

  if (command[0] === 'init') {
    // set up REST API connection

    var target = properties.target;

    if (typeof target.user !== 'undefined' && typeof target.pass !== 'undefined') {
      let options_auth = {user: target.user, password: target.pass};
      global.hybrixd.source[target.id].link = new Client(options_auth);
    } else {
      global.hybrixd.source[target.id].link = new Client();
    }
    subprocesses.push('logs(1,"module blockexplorer: initialized ' + target.id + '")');
  } else {
    let symbol = command[0];
    let symbolCommand = command[1];
    let address = command[2];
    var target = {};

    let candidates = []; // List of block explorer sources that can handle $SYMBOL
    for (let id in global.hybrixd.source) { // find the block explorer sources that can handle $SYMBOL
      if (id.split('.')[1] === symbol) { // the blockexplorer id === $BLOCKEXPLORER.$SYMBOL
        if (global.hybrixd.source[id].hasOwnProperty('module') && global.hybrixd.source[id].module === 'blockexplorer') { // check if source is blockexplorer
          candidates.push(global.hybrixd.source[id]);
        }
      }
    }
    let blockexplorer;
    if (candidates.length) {
      target = candidates[Math.floor((Math.random() * candidates.length))]; // Choose random candidate TODO sort based on a scoring
      blockexplorer = target.source.split('.')[0];
    } else {
      blockexplorer = '';
    }

    let factor = (typeof target.factor !== 'undefined' ? target.factor : 8);
    var command = properties.command;

    // handle standard cases here, and construct the sequential process list
    switch (blockexplorer) {
      case 'blockr': // NB blockr has been depreciated, left here for reference
        switch (symbolCommand) {
          case 'balance':
            if (typeof address !== 'undefined') {
              subprocesses.push('func("link",{target:' + jstr(target) + ',command:["/address/balance/' + address + '?confirmations=0"]})');
              subprocesses.push("tran('.data.balance',2,1)");
              subprocesses.push('fail');
              subprocesses.push('form');
              subprocesses.push('done');
            } else {
              subprocesses.push('stop(1,"Please specify an address!")');
            }
            break;
          case 'unspent':
            // example: http://btc.blockr.io/api/v1/address/unspent/
            if (typeof command[1] !== 'undefined') {
              subprocesses.push('func("link",{target:' + jstr(target) + ',command:["/address/unspent/' + address + '"]})');
              subprocesses.push('func("post",{target:' + jstr(target) + ',command:' + jstr(command) + ',data:$})');
            } else {
              subprocesses.push('stop(1,"Please specify an address!")');
            }
            break;
          default:
            subprocesses.push('stop(1,"Source function ' + symbolCommand + ' not supported for ' + blockexplorer + '!")');
        }
        break;
      case 'insight':
        switch (symbolCommand) {
          case 'balance':
            subprocesses.push('func("link",{target:' + jstr(target) + ',command:["/addr/' + address + '/balance"]})');
            subprocesses.push('func("link",{target:' + jstr(target) + ',command:["/addr/' + address + '/unconfirmedBalance"]})');
            subprocesses.push('coll(2)');
            subprocesses.push('stop( (isNaN(data[0])||isNaN(data[1])?1:0), functions.padFloat(functions.fromInt((data[0]+data[1]),' + factor + '),' + factor + ' ) )');
            break;
          case 'unspent':
            // example: https://blockexplorer.com/api/addr/[:addr]/utxo
            if (typeof command[1] !== 'undefined') {
              subprocesses.push('func("link",{target:' + jstr(target) + ',command:["/addr/' + address + '/utxo"]})');
              subprocesses.push('func("post",{target:' + jstr(target) + ',command:' + jstr(command) + ',data:data})');
              subprocesses.push('stop(0,data)');
            } else {
              subprocesses.push('stop(1,"Please specify an address!")');
            }
            break;
          case 'transaction':
            subprocesses.push('func("link",{target:' + jstr(target) + ',command:["/tx/' + command[2] + '"]})');
            subprocesses.push("tran({id:'.txid', fee:'.fees',attachment:'',timestamp:'.time',symbol:'" + symbol + "','fee-symbol':'" + symbol + "','ammount':'.valueOut','source':'unknown',target:'unknown'},2,1)");

            //, fee:'.fees',attachment:'',timestamp:'.time',symbol:'" + symbol + "','fee-symbol':'" + symbol + "','ammount':'.valueOut','source':'unknown',target:'unknown'
            subprocesses.push('stop(1,"error")');
            subprocesses.push('stop(0,data)');
            break;
          case 'history':
            subprocesses.push('func("link",{target:' + jstr(target) + ',command:["/txs/?address=' + command[2] + '"]})');
            // TODO format all data            subprocesses.push("tran({id:'.txid',fee:'.fees',attachment:'',timestamp:'.time',symbol:'" + symbol + "','fee-symbol':'" + symbol + "',ammount:'.valueOut ',source:'unknown',target:unknown'},2,1)");
            // TODO format data
            subprocesses.push('stop(0,data)');
            break;
          default:
            subprocesses.push('stop(1,"Source function ' + symbolCommand + ' not supported for ' + blockexplorer + '!")');
        }
        break;
      case 'cryptoid': // https://chainz.cryptoid.info/api.dws
        var cryptoidApiKey = 'd8d21ccfe2fa&q=lasttxs';
        switch (symbolCommand) {
          case 'balance':
            subprocesses.push('func("link",{target:' + jstr(target) + ',command:["?key=' + cryptoidApiKey + '&q=getbalance&a=' + address + '"]})');
            subprocesses.push('stop( (isNaN(data?1:0), functions.fromInt(data,' + factor + ') )');
            break;
          case 'unspent':
            // example: https://blockexplorer.com/api/addr/[:addr]/utxo
            if (typeof address !== 'undefined') {
              subprocesses.push('func("link",{target:' + jstr(target) + ',command:["?key=' + cryptoidApiKey + '&q=unspent&active=' + address + '"]})');
            } else {
              subprocesses.push('stop(1,"Please specify an address!")');
            }
            break;
          case 'history':
            if (typeof address !== 'undefined') {
              subprocesses.push('func("link",{target:' + jstr(target) + ',command:["?key=' + cryptoidApiKey + 'q=lasttxs&a=' + address + '"]})');
              // TODO format data
              subprocesses.push('stop(0,data)');
            } else {
              subprocesses.push('stop(1,"Please specify an address!")');
            }
            break;
          case 'transaction':
            if (typeof address !== 'undefined') {
              subprocesses.push('func("link",{target:' + jstr(target) + ',command:["?key=' + cryptoidApiKey + '&q=txinfo&t=' + address + '"]})');
              // TODO format data
            } else {
              subprocesses.push('stop(1,"Please specify a transaction id!")');
            }
            break;
          default:
            subprocesses.push('stop(1,"Source function ' + symbolCommand + ' not supported for ' + blockexplorer + '!")');
        }
        break;
      case 'abe':
        switch (symbolCommand) {
          case 'balance':
            subprocesses.push('stop(1,"NOT YET SUPPORTED!")');
            /*
          request = 'POST';
          if(command.shift()==='balance') {	// rewrite command for literal link
          actionpath = 'addressbalance/'+command.shift();
          } */
            break;
          case 'unspent':
            // example: http://explorer.litecoin.net/unspent/LYmpJZm1WrP5FSnxwkV2TTo5SkAF4Eha31
            if (typeof command[1] !== 'undefined') {
              subprocesses.push('func("link",{target:' + jstr(target) + ',command:["/unspent/' + address + '"]})');
              subprocesses.push('func("post",{target:' + jstr(target) + ',command:' + jstr(command) + ',data:data})');
            } else {
              subprocesses.push('stop(1,"Please specify an address!")');
            }
            break;
          default:
            subprocesses.push('stop(1,"Source function ' + symbolCommand + ' not supported for ' + blockexplorer + '!")');
        }
        break;
      default:
        subprocesses.push('stop(1,"Configured source type is not supported!")');
    }
  }

  // fire the Qrtz-language program into the subprocess queue
  scheduler.fire(processID, subprocesses);
}

// standard function for postprocessing the data of a sequential set of instructions
function post (properties) {
  // decode our serialized properties
  let processID = properties.processID;
  let target = properties.target;
  let mode = target.mode;
  let factor = (typeof target.factor !== 'undefined' ? target.factor : 8);
  // first do a rough validation of the data
  let postdata = properties.data;
  // set data to what command we are performing
  global.hybrixd.proc[processID].data = properties.command;
  // handle the command
  let result = null;
  let success = true;
  switch (mode.split('.')[1]) {
    case 'blockr': // NB blockr has been depreciated, left here for reference
      switch (properties.command[1]) {
        case 'unspent':
          if (typeof postdata.data !== 'undefined' && typeof postdata.data.unspent === 'object') {
            postdata = postdata.data.unspent;
            result = [];
            for (var i in postdata) {
              // TODO script is missing
              result.push({amount: functions.padFloat(postdata[i].amount, factor), txid: postdata[i].tx, txn: postdata[i].n});
            }
          } else { success = false;	}
          break;
        default:
          success = false;
      }
      break;
    case 'insight':
      switch (properties.command[1]) {
        case 'unspent':
          if (typeof postdata !== 'undefined' && postdata !== null) {
            result = [];
            for (var i in postdata) {
              result.push({script: postdata[i].scriptPubKey, amount: functions.padFloat(postdata[i].amount, factor), txid: postdata[i].txid, txn: postdata[i].vout});
            }
          } else { success = false; }
          break;
        default:
          success = false;
      }
      break;
    case 'abe':
      switch (properties.command[1]) {
        case 'unspent':
          if (typeof postdata !== 'undefined' && postdata !== null && typeof postdata.unspent_outputs === 'object') {
            postdata = postdata.unspent_outputs;
            result = [];
            for (var i in postdata) {
              result.push({script: postdata[i].script, amount: functions.fromInt(postdata[i].value, factor), txid: postdata[i].tx_hash, txn: postdata[i].tx_output_n});
            }
          } else { success = false;	}
          break;
        default:
          success = false;
      }
      break;
    default:
      success = false;
  }
  // handle sorting and filtering
  global.hybrixd.proc[processID].progress = 0.5;
  switch (properties.command[1]) {
    case 'unspent':
      if (typeof properties.command[3] !== 'undefined') {
        let amount = functions.toInt(properties.command[3], factor);
        if (amount.greaterThan(0)) {
          result = functions.sortArrayByObjKey(result, 'amount', false);
          global.hybrixd.proc[processID].progress = 0.75;
          unspentscnt = functions.toInt(0, factor);
          let usedinputs = [];
          let unspents = [];
          // pull together the smaller amounts
          for (var i in result) {
            entry = functions.toInt(result[i].amount, factor);
            if (unspentscnt.lessThan(amount) && amount.greaterThanOrEqualTo(entry)) {
              unspents.push(result[i]);
              usedinputs.push(i);
              unspentscnt = unspentscnt.plus(entry);
            }
          }
          // add up the bigger amounts
          if (unspentscnt.minus(amount) < 0) {
            for (var i in result) {
              entry = functions.toInt(result[i].amount, factor);
              if (unspentscnt.lessThan(amount) && amount.lessThanOrEqualTo(entry)) {
                unspents.push(result[i]);
                usedinputs.push(i);
                unspentscnt = unspentscnt.plus(entry);
              }
            }
          }
          let unspentsout = unspentscnt.minus(amount);
          result = {unspents: unspents, change: functions.fromInt((unspentsout > 0 ? unspentsout : 0), factor)};
        }
      }
      break;
  }
  // stop and send data to parent
  scheduler.stop(processID, success ? 0 : 1, result);
}

function link (properties) {
  let processID = properties.processID;
  let target = properties.target;
  let mode = target.mode;
  let type = 'GET'; // for now everything is GET
  // var nopath = (properties.nopath!=='undefined' && properties.nopath?true:false);
  let command = properties.command;
  console.log(' [.] module blockexplorer: sending query [' + target.id + '] -> ' + command.join(' '));

  let upath = command.shift();
  let params = command.shift();
  var args = {};

  if (DEBUG) { console.log(' [D] query to: ' + queryurl); }
  // if POST -- FIXME
  /* var args = {
     data: {
     "method": null,
     "params": command,
     "jsonrpc": "2.0",
     "id": 0
     },
     headers:{"Content-Type": "application/json"},
     path:command
     } */
  var args = {
    headers: {'Content-Type': 'application/json'},
    path: upath
  };
  // construct the APIqueue object
  APIqueue.add({ 'method': type,
    'link': 'source["' + target.id + '"]', // make sure APIqueue can use initialized API link
    'host': target.host,
    'args': args,
    'throttle': target.throttle,
    'pid': processID,
    'target': target.id });
}
