import corenlp

import nlpio, json
from sklearn.base import BaseEstimator,TransformerMixin

def write_file(path, content):
  print 'Writing file: ' + path
  f = open(path, 'w')
  f.write(content)
  f.close()

class SimpleTextCleaner(BaseEstimator,TransformerMixin):
    #TODO: make better
    def __init__(self):
        pass

    def fit(self,documents,y=None):
        return self

    def transform(self,documents):
        for doc in documents:
            # Nothing todo here for now.
            pass
            # doc.text = re.sub("`|'|\"","",doc.text)
            # doc.text = re.sub("(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\\.","\\1",doc.text)
        return documents

class SimpleTextParser(BaseEstimator,TransformerMixin):
    #TODO: make better
    def __init__(self):
        pass

    def fit(self,documents,y=None):
        return self

    def transform(self,documents):
        for doc in documents:
            print 'Parsing: ' + doc.name
            doc.ext['coreNLP'] = nlpio.stanfordParse(doc.text)
        return documents

if __name__ == '__main__':
    docs = nlpio.loadDocumentsFromFile(
        'testset.txt',
        # 'testset_all.txt',
        'data/eval/models/1/', 'data/eval/peers/1/')

    print 'Do Cleanup...'
    textCleaner = SimpleTextCleaner()
    textCleaner.transform(docs)

    print 'Writing file and start coreNLP processing...'

    # Writing out the individual files.
    for doc in docs:
        write_file('tmp/' + doc.name, doc.text)

    # Writing the filelist
    write_file('tmp/filelist.txt', '\n'.join(
        ['tmp/' + doc.name for doc in docs]))

    # REQUIRED: Install `xmltodict` using pip.
    parseRes = corenlp.batch_parse_filelist('tmp/filelist.txt')

    # NOTE: The order in which the files come back from the parseRes generator
    # is determined by a sort on the input file's name.
    i = 0
    it = iter(parseRes)
    for parsed_data in it:
        file_name = parsed_data['file_name']

        found = False
        for doc in docs:
            if doc.name == file_name:
                write_file('output/' + doc.name.replace('.', '_') + '.json',
                    json.dumps({
                        'path': doc.path,
                        'models': doc.models,
                        'modelFileNames': doc.modelFileNames,
                        'parse': parsed_data
                    },indent=2))
                found = True
                break

        if not found:
            raise Exception('Could not find document for parsed tree: ' + file_name)




