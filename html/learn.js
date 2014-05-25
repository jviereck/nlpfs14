var cluster = require('cluster');
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

var sentenceRanking = {};

fs.readFileSync('sentence_ranking.txt', 'utf8').split('\n').forEach(function(line) {
  var splits = line.split('\t');
  var rankings = [];
  for (var i = 1; i < splits.length; i += 2) {
    rankings.push({
      sidx: parseInt(splits[i]),
      score: parseFloat(splits[i + 1])
    });
  }
  sentenceRanking[splits[0]] = rankings;
})

var docs = inputFiles.map(function(filename) {
  var doc = new Document(
    JSON.parse(fs.readFileSync('data/' + filename + '.json', 'utf8')),
    excludeWords);

  doc.removeSayPhase();
  doc.setRefSentences(sentenceRanking[doc.parse.file_name]);
  return doc;
});

if (cluster.isMaster) {
  console.log('I am master');
  cluster.fork();
  cluster.fork();
  cluster.fork();
  // cluster.fork();
  return;
}


var corefSumStart = 3.0 + 0.5 * cluster.worker.id;
var corefSumEnd = 3.0 + 0.5 * cluster.worker.id + 0.5;
console.log('I am worker #' + cluster.worker.id + '\n' +
  'ComputeStart: ' + corefSumStart + '\n' +
  'ComputeEnd:   ' + corefSumEnd);

var maxScore = 0.0;
var maxScoreConfig = [];

for (var corefSum = corefSumStart; corefSum < corefSumEnd; corefSum += 0.25) {
  console.log('=== corefSum=' + corefSum, maxScore, maxScoreConfig);
  var wordSum = 0.3
  // for (var wordSum = 0.0; wordSum < 3.0; wordSum += 0.3) {
    console.log('=== wordSum=' + wordSum, maxScore, maxScoreConfig);
    for (var corefCount = 0.0; corefCount < 1.3; corefCount += 0.3) {
      for (var wordCount = 0.0; wordCount < 1.3; wordCount += 0.3) {
        console.log('=== wordCount=' + wordCount, maxScore);
        for (var corefSumPower = 0.0; corefSumPower < 1.3; corefSumPower += 0.2) {
          for (var wordSumPower = 0.0; wordSumPower < 2.0; wordSumPower += 0.2) {
            var score = 0.0;
            for (var n = 0; n < docs.length; n++) {
              score += docs[n].scoreSentences(
                corefSum, wordSum, corefCount, wordCount, corefSumPower, wordSumPower
              );
            }

            if (score > maxScore) {
              maxScore = score;
              maxScoreConfig = [
                corefSum, wordSum, corefCount, wordCount, corefSumPower, wordSumPower
              ];
            }
          }
        }
      }
    }
  // }
}

console.log('Best Score: ' + maxScore);
console.log('Best Configuration: ');
console.log(maxScoreConfig);

