function Document(data, excludeWords) {
	this.data = data;
	this.excludeWords = excludeWords;

	this.corefs = [];
  this.sentences = [];
  this.words = [];
  this.wordsSorted = [];
  this.modelFileNames = data.modelFileNames;
  this.parse = data.parse;

  this.parseData();
}

Document.prototype.parseCorefs = function() {
	this.corefs = this.data.parse.coref.map(function(entries) {
    var obj = {
      representive: entries[0][1][0],
      refs: []
    }
    function addRef(subEntry) {
      obj.refs.push({
        text: subEntry[0],
        sentence: subEntry[1],
        head: subEntry[2],
        start: subEntry[3],
        end: subEntry[4]
      });
    }

    // Add the representive itself to the references.
    addRef(entries[0][1]);

    // Add the other coreferences to the references as well.
    entries.forEach(function(entry) {
      addRef(entry[0]);
    })
    return obj;
  }, this).sort(function(a, b) {
    return b.refs.length - a.refs.length;
  });
}

Document.prototype.parseData = function() {
	this.words = {};
  this.parseCorefs();

  this.sentences = this.data.parse.sentences;

  this.data.parse.sentences.forEach(function(sentence, sidx) {
    sentence.content = sentence.text.join(' ');

    // This adds the `parseNode` on each word.
    parseSentenceTree(sentence);

    sentence.words.forEach(function(wordData, widx) {
      word = wordData[1];

      // Only look at verbs and nouns.
      if (!word.PartOfSpeech.startsWith('VB')
         && !word.PartOfSpeech.startsWith('NN')
      )
      {
        return;
      }

      // There are some words that occure quite often (e.g. `be`), which are
      // excluded in this analysis.
      if (this.excludeWords.indexOf(word.Lemma) !== -1) {
        return;
      }

      if (!this.words[word.Lemma]) {
        this.words[word.Lemma] = {
          lemma: word.Lemma,
          refs: []
        }
      }

      this.words[word.Lemma].refs.push({
        sentence: sentence,
        sidx: sidx,
        word: word,
        widx: widx
      });
    }, this);
  }, this);

  var self = this;

  this.wordsSorted = Object.keys(this.words).sort(function(a, b) {
    return self.words[b].refs.length - self.words[a].refs.length;
  }).map(function(wordLemma) {
    return self.words[wordLemma];
  }).filter(function(word) {
    return word.refs.length >= 3; // Only keep words that are mentioned 3 or more times.
  })
}

// ############################################################################
// === Helper functions ===

function matchSayPhase(node) {
  var c = node.children;
  var res = [];
  // Check if this node matches.
  for (var i = 0; i < c.length - 1; i++) {
    if (c[i].kind === 'NP' && c[i + 1].kind === 'VP' && /say|said|says/.test(c[i + 1].text)) {
      // Assume the next word is directly "say/said/says". The VP part
      // can be very long and it shouldn't all be ignored!
      res.push({start: c[i].start, end: c[i].end + 1 });
    }
  }

  // Check all the children.
  for (var i = 0; i < c.length; i++) {
    res = res.concat(matchSayPhase(c[i]));
  }

  return res;
}

// ############################################################################
// === This is the code to parse the sentence tree ===

function isLeave(str) {
  var open = str.indexOf('(');
  var close = str.indexOf(')');
  return (open === -1 || open > close);
}

var parseWordIdx = 0;
var parseSentence = null;

function Node(parentNode, kind, text) {
  this.parent = parentNode;
  this.kind = kind;
  this.children = [];
  this.text = text;
  this.start = parseWordIdx;
  this.end = parseWordIdx + 1;

  if (text !== '') { // Ugly hack to check if node is a leave.
    parseSentence.words[this.start][1].ParseNode = this;
  }
}

function parseNode(str, parentNode) {
  var space = str.indexOf(' ');
  var kind = str.substring(0, space);

  if (isLeave(str)) {
    var close = str.indexOf(')');
    parentNode.children.push(new Node(parentNode, kind, str.substring(space + 1, close)));
    parseWordIdx += 1;
    return close + 1;
  } else {
    var newNode = new Node(parentNode, kind, '');
    parentNode.children.push(newNode);

    var end = space;
    while (str[end] == ' ') {
      end = parseNode(str.substring(end + 2), newNode) + end + 2;
    }

    // Update the text and wordEnd of the node based on the text of the child
    // nodes.
    newNode.text = newNode.children.map(function(child) {
      return child.text;
    }).join(' ').trim();
    newNode.end = parseWordIdx;

    return end + 1;
  }
}

function parseSentenceTree(sentence) {
  parseWordIdx = 0;
  parseSentence = sentence;
  var str = sentence.parsetree.substring(1);
  var root = new Node(null, 'START', '');
  parseNode(str, root);
  return root.children[0];
}

if (typeof exports !== 'undefined') {
	exports.Document = Document;
}



/*! http://mths.be/startswith v0.2.0 by @mathias */
if (!String.prototype.startsWith) {
  (function() {
    'use strict'; // needed to support `apply`/`call` with `undefined`/`null`
    var defineProperty = (function() {
      // IE 8 only supports `Object.defineProperty` on DOM elements
      try {
        var object = {};
        var $defineProperty = Object.defineProperty;
        var result = $defineProperty(object, object, object) && $defineProperty;
      } catch(error) {}
      return result;
    }());
    var toString = {}.toString;
    var startsWith = function(search) {
      if (this == null) {
        throw TypeError();
      }
      var string = String(this);
      if (search && toString.call(search) == '[object RegExp]') {
        throw TypeError();
      }
      var stringLength = string.length;
      var searchString = String(search);
      var searchLength = searchString.length;
      var position = arguments.length > 1 ? arguments[1] : undefined;
      // `ToInteger`
      var pos = position ? Number(position) : 0;
      if (pos != pos) { // better `isNaN`
        pos = 0;
      }
      var start = Math.min(Math.max(pos, 0), stringLength);
      // Avoid the `indexOf` call if no match is possible
      if (searchLength + start > stringLength) {
        return false;
      }
      var index = -1;
      while (++index < searchLength) {
        if (string.charCodeAt(start + index) != searchString.charCodeAt(index)) {
          return false;
        }
      }
      return true;
    };
    if (defineProperty) {
      defineProperty(String.prototype, 'startsWith', {
        'value': startsWith,
        'configurable': true,
        'writable': true
      });
    } else {
      String.prototype.startsWith = startsWith;
    }
  }());
}