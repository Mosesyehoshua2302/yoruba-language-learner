import pdfplumber, json, re, sys
sys.path.insert(0,'.')
from decode import decode

PDF='/sessions/inspiring-quirky-lamport/mnt/uploads/YorubaYeMi-textbook.pdf'
# book-page ranges
CH = {
 1:{'vocab':(24,25),'lessons':[(26,32),(33,36),(37,40),(41,46)],'cover':23},
 2:{'vocab':(48,50),'lessons':[(51,54),(55,56),(57,65),(66,70)],'cover':47},
 3:{'vocab':(72,72),'lessons':[(73,75),(76,78),(79,81),(82,86)],'cover':71},
 4:{'vocab':(88,89),'lessons':[(90,94),(95,103),(104,107),(108,110)],'cover':87},
 5:{'vocab':(112,114),'lessons':[(115,118),(119,120),(121,134),(135,138)],'cover':111},
 6:{'vocab':(140,141),'lessons':[(142,143),(144,145),(146,151),(152,156)],'cover':139},
 7:{'vocab':(158,162),'lessons':[(163,166),(167,172),(173,179),(180,184)],'cover':157},
 8:{'vocab':(186,191),'lessons':[(192,193),(194,197),(198,205),(206,210)],'cover':185},
 9:{'vocab':(212,215),'lessons':[(216,217),(218,219),(220,226)],'cover':211},
 10:{'vocab':(228,230),'lessons':[(231,237),(238,245),(246,253),(254,258)],'cover':227},
 11:{'vocab':(260,262),'lessons':[(263,266),(267,268),(269,275),(276,280)],'cover':259},
 12:{'vocab':(282,285),'lessons':[(286,288),(289,292),(293,297),(298,300)],'cover':281},
}
POS_MAP={'nouns':'noun','noun':'noun','nounphrases':'noun-phrase','verbs':'verb','verbphrases':'verb-phrase',
'adjectives':'adjective','adverbs':'adverb','pronouns':'pronoun','others':'other','otherexpressions':'expression',
'expressions':'expression','usefulexpressions':'expression','interrogatives':'interrogative','greetings':'greeting',
'conjunctions':'conjunction','prepositions':'preposition','phrases':'phrase','idioms':'idiom','numbers':'number',
'numerals':'number','verbphrase':'verb-phrase','adjectivesadverbs':'adjective','adjective':'adjective','prepositionalphrases':'prepositional-phrase','prepositionalphrase':'prepositional-phrase','conjunction':'conjunction','interrogative':'interrogative','adjectivephrase':'adjective-phrase','adverb':'adverb','adverbialphrase':'adverbial-phrase','verb':'verb','pronoun':'pronoun','greeting':'greeting','preposition':'preposition','expression':'expression','noun':'noun'}

pdf = pdfplumber.open(PDF)

def get_lines(bp):
    p = pdf.pages[bp-1]
    lines={}
    for w in p.extract_words():
        lines.setdefault(round(w['top']/6.5),[]).append(w)
    out=[]
    for k in sorted(lines):
        ws=sorted(lines[k],key=lambda w:w['x0'])
        txt=' '.join(w['text'] for w in ws)
        if 'COERLL' in txt or re.search(r'Page \d+',txt): continue
        out.append(ws)
    return out

def extract_vocab(bp_range):
    entries=[]; pos=None; skipped=[]
    for bp in range(bp_range[0], bp_range[1]+1):
        for ws in get_lines(bp):
            txt=' '.join(w['text'] for w in ws)
            if '(Chapter' in txt or '(Vocabulary)' in txt or 'Vocabulary' in txt: continue
            left=[w for w in ws if w['x0']<290]; right=[w for w in ws if w['x0']>=290]
            lt=' '.join(w['text'] for w in left).strip(); rt=' '.join(w['text'] for w in right).strip()
            if lt and not rt:
                key=re.sub(r'[^a-z]','',lt.lower())
                if key in POS_MAP: pos=POS_MAP[key]
                else: skipped.append((bp,lt))
            elif rt and not lt:
                if entries: entries[-1]['en']+=' '+decode(rt)
            elif lt and rt:
                entries.append({'yo':decode(lt),'en':decode(rt),'pos':pos or 'other'})
    return entries, skipped

def split_gap(ws):
    best=-1; idx=None
    for i in range(len(ws)-1):
        gap=ws[i+1]['x0']-ws[i]['x1']
        if gap>best and 120<ws[i+1]['x0']<470:
            best=gap; idx=i+1
    if best<25 or idx is None: return None,None
    return ws[:idx], ws[idx:]

def extract_examples(bp_range, cap=10):
    pairs=[]
    import unicodedata
    def yoruba_ish(s):
        d=decode(s)
        return bool(re.search(r'[àáèéìíòóùúẹọṣńǹ]',unicodedata.normalize('NFC',d))) or re.search(r'[ẹọṣ]',d)
    for bp in range(bp_range[0], bp_range[1]+1):
        for ws in get_lines(bp):
            texts=[w['text'] for w in ws]
            # arrow-delimited contraction rows: base + parts -> contracted  gloss
            ai=[i for i,t in enumerate(texts) if '\uf0e0' in t or t=='→']
            if ai:
                i=ai[0]
                yo_words=texts[:i]; j=i+1
                contracted=[]
                while j<len(texts) and yoruba_ish(texts[j]):
                    contracted.append(texts[j]); j+=1
                en=' '.join(texts[j:]).strip()
                if contracted and en and len(en)>2:
                    yo=decode(' '.join(yo_words).replace('\uf0e0','').strip())+' → '+decode(' '.join(contracted))
                    yo=yo.strip(' →')
                    if yo and not yo.startswith('('):
                        pairs.append({'yo':yo,'en':decode(en)})
                continue
            left,right=split_gap(ws)
            if left is None: continue
            lt=' '.join(w['text'] for w in left).strip(); rt=' '.join(w['text'] for w in right).strip()
            if not lt or not rt: continue
            lt=re.sub(r'^\d+[\.\)]\s*','',lt); rt=re.sub(r'^\d+[\.\)]\s*','',rt)
            dlt=decode(lt); drt=decode(rt)
            # left must look Yoruba (has tone/dot chars), right mostly plain ascii-ish English
            if not re.search(r'[àáèéìíòóùúẹọṣńǹ̀́]',dlt): continue
            if re.search(r'[ẹọṣàáèéìíòóùú]',drt): continue
            if len(dlt)>60 or len(drt)>70 or len(drt)<2: continue
            if re.match(r'^[A-Z\s]+$',drt): continue
            if re.search(r'\b(the|will|are|is|of|to|you|below|following)\b',dlt): continue
            pairs.append({'yo':dlt,'en':drt})
    # dedupe
    seen=set(); out=[]
    for p in pairs:
        k=p['yo']
        if k in seen: continue
        seen.add(k); out.append(p)
    return out[:cap]

def cover_info(bp):
    p=pdf.pages[bp-1]
    return decode(p.extract_text() or '')

result={}
all_skipped={}
for ch,info in CH.items():
    vocab,skipped=extract_vocab(info['vocab'])
    lessons=[extract_examples(r) for r in info['lessons']]
    result[ch]={'vocab':vocab,'lesson_examples':lessons,'cover':cover_info(info['cover'])}
    all_skipped[ch]=skipped
    print(f"ch{ch}: {len(vocab)} vocab, examples per lesson: {[len(l) for l in lessons]}, skipped lines: {len(skipped)}")
json.dump(result,open('extracted.json','w'),ensure_ascii=False,indent=1)
json.dump(all_skipped,open('skipped.json','w'),ensure_ascii=False,indent=1)
