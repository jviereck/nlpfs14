import nlpio

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

if __name__ == '__main__':
    docs = nlpio.loadDocumentsFromFile(
        'testset_all.txt', 'data/eval/models/1/', 'data/eval/peers/1/')

    print 'Do Cleanup...'
    textCleaner = SimpleTextCleaner()
    textCleaner.transform(docs)




