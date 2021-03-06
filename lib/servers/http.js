var http = require('http');
var router = require('../router');
var functions = require('../functions');

function createResponse (request, response) {
  // help ->       content as flat html   type:'text/html'
  // storage ->    file as data           type:'file:data'
  // det. blob ->  file as data           type:'file:data'
  // web_walet ->  file as flat html      type:'file:text/html'
  // views ->      file as flat json      type:'application/json'

  var result = router.route(request);
  if (typeof result.type === 'undefined' || result.type === 'data') {
    response.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    delete (result.recipe);
    response.write(JSON.stringify(result));
    response.end();
  } else {
    response.writeHead(200, {
      'Content-Type': result['type'],
      'Access-Control-Allow-Origin': '*'
    });
    response.end(result.data);
  }
}

function handleRequest (request, response, entryPoint) {
  if (entryPoint === '/root') {
    request.sessionID = 1;
  } else {
    request.url = entryPoint + request.url;
    request.sessionID = 0;
  }

  if (request.method === 'POST') {
    let data = '';
    request.on('data', chunk => {
      data += chunk.toString(); // convert Buffer to string
    });
    request.on('end', () => {
      request.data = data;
      createResponse(request, response);
    });
  } else if (request.method === 'GET') {
    var url_getdata = request.url.split('/POST=');// TODO seperator kiezen and move to router?
    if (url_getdata.length > 1) {
      request.data = url_getdata[1];
    } else {
      request.data = null;
    }
    createResponse(request, response);
  }
}

function init (endpoint, entryPoint, callbackArray) {
  // http://hostname:port
  var protocol_hostnameport = endpoint.split('://');
  var protocol = protocol_hostnameport[0];
  var hostname_port = protocol_hostnameport[1].split(':');
  var hostname = hostname_port[0];
  var port = hostname_port[1];

  var server = http.createServer(function (request, response) {
    handleRequest(request, response, entryPoint);
  });

  server = server.listen(port, hostname, undefined, function () {
    console.log(` [i] REST API endpoint running on: ${protocol}://${hostname}:${port} -> ${entryPoint}`);
    functions.sequential(callbackArray);
  });

  return server;
}

var close = function (server, callbackArray) {
  if (status(server)) {
    var protocol_hostnameport = server.endpoint.split('://');
    var protocol = protocol_hostnameport[0];
    var hostname_port = protocol_hostnameport[1].split(':');
    var hostname = hostname_port[0];
    var port = hostname_port[1];
    server.server.close(function () {
      console.log(` [i] REST API endpoint closed for: http://${hostname}:${port}`);
      functions.sequential(callbackArray);
    });
  } else { // No server to be closed, callback directly
    functions.sequential(callbackArray);
  }
};

var open = function (server, callbackArray) {
  if (!status(server)) {
    var protocol_hostnameport = server.endpoint.split('://');
    var protocol = protocol_hostnameport[0];
    var hostname_port = protocol_hostnameport[1].split(':');
    var hostname = hostname_port[0];
    var port = hostname_port[1];
    server.server.listen(port, hostname, undefined, function () {
      console.log(` [i] REST API endpoint running on: http://${hostname}:${port}`);
      functions.sequential(callbackArray);
    });
  } else { // No server to be initialized, callback directly
    functions.sequential(callbackArray);
  }
};

var status = function (server) {
  return server.server.listening;
};

exports.init = init;
exports.close = close;
exports.open = open;
exports.status = status;
