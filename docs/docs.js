function display (result) {
  document.getElementById('console-results').style.height = '150px';
  document.getElementById('console-close').innerHTML = 'Hide';
  var r = '';
  if (result.error === 0) {
    if (result.id === 'id') {
      r += '<div class="result">[.] Waiting for result ' + result.data + '...';
      rout('/proc/' + result.data);
    } else {
      r += '<div class="result">[i] <span class="result">' + result.path + '</span> - <code>' + JSON.stringify(result.data) + '</code>';
    }
  } else {
    r += '<div class="error">[!] <span class="result">' + result.path + '</span> - ';
    if (result.hasOwnProperty('info')) { r += result.info; }
    if (result.hasOwnProperty('help')) {
      r += result.help.replace(/\`([^\`])*\`/g, (a, x) => {
        var url = a.substr(1, a.length - 2);
        return '<a href="/api/help' + url + '">' + url + '</a>';
      }
      );
    }

    if (result.hasOwnProperty('data')) { r += result.data; }
  }

  r += '</div>';
  var consoleResults = document.getElementById('console-results');
  consoleResults.innerHTML += r;
  setTimeout(() => { consoleResults.lastChild.scrollIntoView(false); }, 100);
}

function rout (path, noHistory) {
  if (!noHistory) {
    commands.push(path); commandIndex = commands.length;
  }
  var url = window.location.protocol + '//' + window.location.host + (window.location.pathname.startsWith('/api') ? '/api' : '') + path;
  var xhr = new XMLHttpRequest();
  xhr.open('GET', url, true);
  xhr.onreadystatechange = e => {
    if (xhr.readyState == 4) {
      if (xhr.status >= 200 && xhr.status <= 299) {
        var header = xhr.getResponseHeader('Content-Type');
        if (header === 'application/json') {
          var result;
          try {
            result = JSON.parse(xhr.responseText);
          } catch (e) {
            result = {info: 'Unknown Error', error: 1};
          }
          if (result.error === 0 && result.hasOwnProperty('progress') && result.progress !== 1) {
            setTimeout(() => { rout(path, true); }, 500);
          } else {
            display(result);
          }
        } else {
          document.write(xhr.responseText);
        }
      }
    }
  };
  xhr.send();
}

function search (e) {
  if (e.target.value == '') { return; }
  var es = document.getElementsByClassName('command-body');
  var first = true;
  for (let i = 0; i < es.length; ++i) {
    if (es[i].innerHTML.toLowerCase().indexOf(e.target.value.toLowerCase()) !== -1) {
      es[i].style.display = 'block';
      if (first) { es[i].previousSibling.scrollIntoView(); }
      first = false;
    } else {
      es[i].style.display = 'none';
    }
  }
}

function toggleCommand (id) {
  var e = document.getElementById(id);
  e.style.display = e.style.display === 'block' ? 'none' : 'block';
}

function collapseAll () {
  var es = document.getElementsByClassName('command-body');
  for (let i = 1; i < es.length; ++i) {
    es[i].style.display = 'none';
  }
}

function toggleConsole () {
  var e = document.getElementById('console-results');
  var c = document.getElementById('console-close');
  if (e.style.height === '150px') {
    c.innerHTML = 'Show';
    e.style.height = '0';
  } else {
    c.innerHTML = 'Hide';
    e.style.height = '150px';
  }
}
var commands = [];
var lastCommand = -1;

const copyToClipboard = str => {
  const el = document.createElement('textarea');
  el.value = str;
  document.body.appendChild(el);
  el.select();
  document.execCommand('copy');
  document.body.removeChild(el);
};

var menuItems = {
  'HelloWorld': '/api/help/HelloWorld',
  'REST API': '/api/help',
  'hybrid-lib.js': '/api/help/hybrid-lib.js',
  'Hybridd': '/api/help/hybridd',
  'cli': '/api/help/cli',
  'qrtz': '/api/help/qrtz'
};

function initNavigation (currentMenuItem) {
  var data = '';
  data += '<h1>hybridd : ' + currentMenuItem + '</h1> ';
  for (var menuItem in menuItems) {
    if (currentMenuItem === menuItem) {
      data += '<a class="menuItem current">' + menuItem + '</a> ';
    } else {
      data += '<a href="' + menuItems[menuItem] + '" class="menuItem">' + menuItem + '</a> ';
    }
  }

  data += '<br/> ';
  data += '<br/> ';
  data += '<a id="collapseAll" onclick="collapseAll()">Collapse all</a>';
  data += '<br/>';
  data += '<br/>';
  data += '<input id="search" onkeyup="search(event)" placeholder="Search" onclick="search"><br/>';
  document.getElementById('navigation').innerHTML = data;
}