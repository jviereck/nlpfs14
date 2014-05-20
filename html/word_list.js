// Use this script to generate the list of words occurring in the data/* files.
// Useful:
//  node word_list.js > exclude_word.txt
// And then postprocess the `exclude_word.txt` file

var dir = require('node-dir');

var words = {}
var wordsSorted = [];

dir.readFiles('data/', {
	 	match: /.json$/,
  },
 function(err, content, filename, next) {
      if (err) throw err;

      console.log('Processing file=', filename);

      var sentences = JSON.parse(content).parse.sentences;

			sentences.forEach(function(sentence, sidx) {
	      sentence.words.forEach(function(wordData, widx) {
	        word = wordData[1];

	        // Only look
	        if (!word.PartOfSpeech.startsWith('VB')
	           // && !word.PartOfSpeech.startsWith('NN')
	        )
	        {
	          return;
	        }

	        if (!words[word.Lemma]) {
	          words[word.Lemma] = {
	            lemma: word.Lemma,
	            refs: []
	          }
	        }

	        words[word.Lemma].refs.push({
	          sentence: sentence,
	          sidx: sidx,
	          word: word,
	          widx: widx
	        });
	      });
    	});

      next();
  },
  function(err, files){
      if (err) throw err;

      console.log('finished reading files');

	    wordsSorted = Object.keys(words).sort(function(a, b) {
	      return words[b].refs.length - words[a].refs.length;
	    }).map(function(wordLemma) {
	      return words[wordLemma];
	    }).forEach(function(word) {
	    	console.log(word.refs.length + '\t' + word.lemma);
	    });

      // console.log('finished reading files:',files);
  });


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