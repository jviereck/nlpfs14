function Document(data, excludeWords) {
  this.data = data;
  this.excludeWords = excludeWords;

  this.corefs = [];
  this.sentences = [];
  this.words = {};
  this.wordsSorted = [];
  this.modelFileNames = data.modelFileNames;
  this.parse = data.parse;

  this.parseData();
}

Document.prototype.setRefSentences = function(refSentences) {
  this.refSentences = refSentences;
  this.refSentencesMap = {};
  refSentences.forEach(function(rank) {
    this.refSentencesMap[rank.sidx] = rank.score
  }, this);
}

function uniq(array) {
  var res = [];
  for (var i = 0; i < array.length; i++) {
    if (res.indexOf(array[i]) === -1) {
      res.push(array[i]);
    }
  }
  return res;
}

Document.prototype.printDependency = function(sentence) {
  var depRoot = sentence.dependencyRoot;

  var seen = {};

  function pWord(word) {
    var ret = '(' + word[1].Weight.toFixed(1) + '|' + word[1].SubWeight.toFixed(1) + ') ' + word[0] + '[' + word[1].PartOfSpeech + ']';
    if (word[1].Ignore) {
      return '*' + ret;
    } else {
      return ret;
    }
  }

  function printWord(word, indent) {
    (word[1].Deps || []).forEach(function(dep) {
      console.log(indent + pWord(word) + ' -(' + dep[0] + ')-> ' + pWord(dep[1]));

      printWord(dep[1], indent + '| ');
    })
  }

  printWord(depRoot, '');
}

var requiredParts = {
  'ALL': ['det'],
  'VBD': ['nsubj', 'dobj', 'det', 'prt']
}

function getDep(word, type) {
  var ref = word[1].Deps.filter(function(ref) {
    return ref[0] === type;
  });
  if (ref.length > 0) {
    return ref[0][1];
  } else {
    return null;
  }
}

Document.prototype.getSummary = function() {
  var sentence = this.sentences[0];

  var maxLen = 75;

  function gatterSubtrees(word, isRoot) {
    var pos = word[1].PartOfSpeech;
  }

  function printSubtree(word, extraLength, isRoot) {
    var pos = word[1].PartOfSpeech;

    if (word[1].Ignore) {
      if (isRoot) {
        var newRootWord = getDep(word, 'ccomp')
        return printSubtree(newRootWord, extraLength, isRoot);
      } else {
        return [];
      }
    }

    var required = requiredParts.ALL.concat(requiredParts[pos] || []);
    var requiredWords = required.map(function(requiredType) {
      if (word[1].Deps === undefined) {
        return null;
      }
      var depWord = getDep(word, requiredType);
      if (depWord) {
        return printSubtree(depWord, 0 /* Only the minimum for now */);
      } else {
        return null;
      }
    }).filter(function(entry) {
      return !!entry;
    })

    return requiredWords.concat([[word]]);
  }

  return printSubtree(s.dependencyRoot, 0, true);
}

Document.prototype.getRefRankedSentence = function() {
  return this.refSentences.map(function(rank) {
    return '#' + rank.sidx + ': ' +
        this.sentences[rank.sidx].content + ' (' + rank.score.toFixed(3) + ')';
  }, this);
}

// Best Score: 11.615
// Best Configuration: [0.75, 0.3, 2.9, 0.0, 0.8, 1.6 ]
// Best Score: 11.753
// Best Configuration: [1.50, 0.3, 2.1, 0.3, 0.6, 1.6 ]
// Best Score: 11.753
// Best Configuration: [2.50, 0.3, 0.6, 0.3, 0.4, 1.6 ]
// Best Score: 11.753
// Best Configuration: [3.00, 0.3, 0.9, 0.6, 0.4, 1.6 ]


Document.prototype.rankSentences = function(
    corefSum, wordSum, corefCount, wordCount, corefSumPower, wordSumPower) {
  return this.sentences.map(function(sentence, sidx) {
    var uCorefs = uniq(sentence.corefs);
    var mainWords = sentence.mainWords;

    var score = 0.0;

    var t  = 0.0;
    for (var i = 0; i < uCorefs.length; i++) {
      t += Math.pow(uCorefs[i].parent.refs.length, corefSumPower);
    }
    score += corefSum * t;

    t  = 0.0;
    for (var i = 0; i < mainWords.length; i++) {
      t += Math.pow(mainWords[i].parent.refs.length, wordSumPower);
    }
    score += wordSum * t;

    score += corefCount * uCorefs.length;
    score += wordCount * mainWords.length

    return {
      sidx: sidx,
      score: score
    }
  }).sort(function(a, b) {
    return b.score - a.score;
  });
}

Document.prototype.rankOptimalSentences = function() {
  return this.rankSentences.apply(this, [2.5, 0.3, 0.6, 0.3, 0.4, 1.5999999999999999 ]);
}


Document.prototype.scoreSentences = function(
  corefSum, wordSum, corefCount, wordCount, corefSumPower, wordSumPower) {
  var bestSentence = this.rankSentences(
    corefSum, wordSum, corefCount, wordCount, corefSumPower, wordSumPower)[0];
  return this.refSentencesMap[bestSentence.sidx] || 0.0
}

Document.prototype.parseCorefs = function() {
  var self = this;
  this.corefs = this.data.parse.coref.map(function(entries) {
    var obj = {
      representive: entries[0][1][0],
      refs: []
    }
    function addRef(subEntry) {
      var newRef = {
        text: subEntry[0],
        sentence: subEntry[1],
        head: subEntry[2],
        start: subEntry[3],
        end: subEntry[4],
        parent: obj
      };
      obj.refs.push(newRef);
      self.sentences[newRef.sentence].corefs.push(newRef);
    }

    // Add the representive itself to the references.
    addRef(entries[0][1]);

    // Add the other coreferences to the references as well.
    entries.forEach(function(entry) {
      addRef(entry[0]);
    })
    return obj;
  }, this);

  this.cleanupCorefs();
}

Document.prototype.cleanupCorefs = function() {
  this.corefs = this.corefs.filter(function(coref) {
    return coref.refs.length > 0;
  }).sort(function(a, b) {
    return b.refs.length - a.refs.length;
  });
}

Document.prototype.parseData = function() {
  this.words = {};
  this.sentences = this.data.parse.sentences;

  this.data.parse.sentences.forEach(function(sentence, sidx) {
    sentence.corefs = [];
    sentence.content = sentence.text.join(' ');
    sentence.mainWords = [];

    sentence.dependencyRoot =
      sentence.words[parseInt(sentence.dependencies.splice(0, 1)[0][2], 10) - 1];

    var words = sentence.words;
    // var deps = {};
    sentence.dependencies.forEach(function(entry) {
      var word = words[parseInt(entry[1], 10) - 1];
      var dependent = words[parseInt(entry[2], 10) - 1];

      if (word[1].Deps === undefined) {
        word[1].Deps = [];
      }

      dependent[1].DepParent = word;
      word[1].Deps.push([
        entry[0],
        dependent
      ]);
    });

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

      var ref = {
        sentence: sentence,
        sidx: sidx,
        word: word,
        widx: widx,
        parent: this.words[word.Lemma]
      };
      this.words[word.Lemma].refs.push(ref);

      sentence.mainWords.push(ref);
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

  this.parseCorefs();

  // This adds the `parseNode` on each word.
  this.data.parse.sentences.forEach(function(sentence, sidx) {
    sentence.parseRoot = parseSentenceTree(sentence);
  });
}

function doIntersect(a, b) {
  return (b.start < a.end && a.end <= b.end) ||
      (b.start <= a.start && a.start < b.end);
}

Document.prototype.removeSayPhase = function() {
  this.sentences.forEach(function(sentence, sidx) {
    var says = matchSayPhase(sentence.parseRoot);

    says.filter(function(say) {
      return sidx !== 0 || say.start !== 0;
      // return true;
    }).forEach(function(say) {
      // Mark the words that match with the says as "ignore".
      var words = sentence.words;
      for (var i = say.start; i < say.end; i++) {
        words[i][1].Ignore = 'SayPhase';
      }

      // Look for coreferences inside of say-phrases and remove them.
      for (var i = sentence.corefs.length - 1; i >= 0; i--) {
        if (doIntersect(sentence.corefs[i], say)) {
          var ref = sentence.corefs.splice(i, 1)[0];
          var parentRefs = ref.parent.refs;
          parentRefs.splice(parentRefs.indexOf(ref), 1);
        }
      }
    });
  }, this);

  // As some corefs were removed, sort the order once more.
  this.cleanupCorefs();
  return this;
}

Document.prototype.weightWords = function() {
  this.sentences.forEach(function(sentence, sidx) {
    // Reset all weights.
    sentence.words.forEach(function(word) {
      word[1].Weight = 0.2 /* Every word has some weight ;) */;
      word[1].SubWeight = 0;
    });

    sentence.corefs.forEach(function(coref) {
      var words = sentence.words;
      for (var i = coref.start; i < coref.end; i++) {
        words[i][1].Weight = coref.parent.refs.length;
      }
    });

    sentence.mainWords.forEach(function(wordRef) {
      var word = wordRef.word;
      word.Weight = Math.max(word.Weight, wordRef.parent.refs.length);
    });

    // Compute the weights for the subtrees.
    sentence.words.forEach(function(wordData) {
      if (wordData[1].Deps === undefined /* Check for leaf dependency */) {
        var weight = wordData[1].Weight;
        var parent = wordData[1].DepParent;
        while (parent) {
          parent[1].SubWeight += weight;
          parent = parent[1].DepParent;
        }
      }
    });
  }, this);

}

Document.prototype.getRepresentiveSentences = function() {
  return this.sentences.map(function(sentence) {
    var words = sentence.words.slice(); // Copy the array

    sentence.corefs.slice().sort(function(a, b) {
      return b.start - a.start;
    }).forEach(function(coref) {
      words.splice(
          coref.start, coref.end - coref.start,
          [coref.parent.representive, {Coref: coref}]);
    });

    return words.filter(function(word) {
      return word[1].Ignore === undefined;
    }).map(function(word) {
      return word[0]
    }).join(' ');
  }, this);
};

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