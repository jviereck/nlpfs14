var fs = require('fs');
var _ = require('underscore');
var Document = require('./doc.js').Document;

var excludeWords = fs.readFileSync('exclude_word.txt', 'utf8');
excludeWords = excludeWords.split('\n').map(function(line) {
  return line.split('\t')[1];
});

var inputFiles =
  fs.readFileSync('filelist.txt', 'utf8').split('\n').map(function(line) {
    return line.substring(4);
  });

var modelRoot = '/Users/jviereck/Documents/ETH/2014FS/NaturalLanguageProcessing/project/nlpfs14'
var peerRoot = './tmp'

var models = {};
var docs = [];

function esc(str) { return str.replace('.', '_'); }
function uesc(str) { return str.replace('_', '.'); }

function f(i) { if (i < 10) { return '0' + i; } else { return '' + i; } }

function extractSentencesMapper(doc) {
  return doc.sentences.map(function(sentence, index) {
    return {
      id: esc(doc.parse.file_name) + '-' + f(index),
      text: sentence.content
    }
  });
}

function extractSentencesResultHandler(scores) {
  var documents = docs;
  docs = {};

  _.forEach(scores, function(results, peerId) {
    var docName = peerId.split('-')[0];
    if (docs[docName] === undefined) {
      docs[docName] = {
        sIdx: -1,
        score: 0.0
      };
    }
    var score = results['ROUGE-1 Average_F'].score;
    if (score > docs[docName].score) {
      docs[docName].score = score;
      docs[docName].sIdx = parseInt(peerId.split('-')[1]);
    }
  });

  _.forEach(docs, function(bestSentence, docName) {
    console.log(uesc(docName) + '\t' + bestSentence.sIdx + '\t' + bestSentence.score);
  })
}

var execConfig = {
  docMapper: extractSentencesMapper,
  rougeMaxBytes: 9999,
  rougeResultHandler: extractSentencesResultHandler,
  runRougeOnly: false
}

var docs = inputFiles.map(function(filename) {
  return new Document(
    JSON.parse(fs.readFileSync('data/' + filename + '.json', 'utf8')),
    excludeWords);
});

if (!execConfig.runRougeOnly) {

  console.log('Writing rouge input files...');

  // For each input file: Map it's document to the mapper specified above, which
  // will return a list of peers to run on the given model for this document.

  docs.forEach(function(doc) {
    var modelsStr = doc.modelFileNames.join('\n');
    var peers = execConfig.docMapper(doc).map(function(peer) {
      peer.doc = doc;
      return peer;
    });

    if (models[modelsStr] === undefined) {
      models[modelsStr] = [];
    }

    models[modelsStr] = models[modelsStr].concat(peers);
  });

  var evalId = 1;
  var indexToChar = ['A', 'B', 'C', 'D', 'E'];
  // Generate the rough input content and write the peer files:
  var rougeInputContent = '<ROUGE_EVAL version="1.0">\n';
  rougeInputContent += _.map(models, function(peers, modelsStr) {
    var ret = [];
    ret.push('<EVAL ID="' + (evalId++) + '">');
    ret.push('<PEER-ROOT>');
    ret.push('./tmp')
    ret.push('</PEER-ROOT>');
    ret.push('<MODEL-ROOT>');
    ret.push(modelRoot);
    ret.push('</MODEL-ROOT>');
    ret.push('<INPUT-FORMAT TYPE="SPL">');
    ret.push('</INPUT-FORMAT>');

    ret.push('<PEERS>');

    peers.forEach(function(peer) {
      var fileName = esc(peer.doc.parse.file_name) + '-' + peer.id + '.txt';
      fs.writeFileSync('./tmp/' + fileName, peer.text);
      ret.push('<P ID="' + peer.id + '">' + fileName + '</P>');
    });

    ret.push('</PEERS>');

    ret.push('<MODELS>');
    modelsStr.split('\n').forEach(function(model, index) {
      ret.push('<M ID="' + indexToChar[index] + '">' + model + '</M>');
    })
    ret.push('</MODELS>');
    ret.push('</EVAL>');

    return ret.join('\n');
  }).join('\n');
  rougeInputContent += '</ROUGE_EVAL>';

  fs.writeFileSync('rouge.in', rougeInputContent);
}

var rougeRoot =
  '/Users/jviereck/Documents/ETH/2014FS/NaturalLanguageProcessing/project/rouge/';

// Spawning the rough script:
var exec = require('child_process').exec;

var execStr = rougeRoot + 'ROUGE-1.5.5.pl -e ' + rougeRoot + 'data ' +
      '-a -c 95 -b ' + execConfig.rougeMaxBytes + ' -m -n 4 -w 1.2 rouge.in > output.txt';

console.log('Executing: ' + execStr);

exec(execStr, function (error, stdout, stderr) {
  if (error !== null) {
    console.log('exec error: ' + error);
  } else {
    var res = {};
    stdout.split('\n').forEach(function(line) {
      var re = /^(\S+) (ROUGE\S+ Average_[RPF]): (\d+\.\d+) \(95%-conf.int. (\d+\.\d+) \- (\d+\.\d+)\)/;
      var match = re.exec(line);
      if (!match) return;

      var id = match[1];
      if (res[id] === undefined) {
        res[id] = {};
      }

      res[id][match[2]] = {
        score: parseFloat(match[3]),
        confMin: parseFloat(match[4]),
        confMax: parseFloat(match[5])
      }
    });
    execConfig.rougeResultHandler(res);
  }
});
