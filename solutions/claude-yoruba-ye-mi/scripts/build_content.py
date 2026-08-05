#!/usr/bin/env python3
"""Assemble content.json from extracted.json + curated lesson metadata."""
import json, re

ex = json.load(open('extracted.json'))

CHAPTERS = {
 1: dict(yo="Orí Kìíní", en="Greetings",
   lessons=[
    ("Ìkíni (Greetings)", "Greetings are formed with kú + a time of day or occasion, and contract: kú + àárọ̀ → káàárọ̀ 'good morning'. Add Ẹ before a greeting to show respect or address more than one person (Ẹ káàárọ̀). The times of day are àárọ̀ (morning), ọ̀sán (afternoon), ìrọ̀lẹ́ (early evening) and alẹ́ (night)."),
    ("Verbs", "Yorùbá verbs are not inflected: the same form serves every person and tense (lọ = go/went). Negation uses kò before the verb: Kò lọ 'He/she did not go'. The progressive uses ń before the verb: Ó ń sùn 'He/she is sleeping'."),
    ("Subject Pronouns", "Short subject pronouns: mo (I), o (you sg.), ó (he/she/it), a (we), ẹ (you pl./respect), wọ́n (they/respect). Emphatic pronouns: èmi, ìwọ, òun, àwa, ẹ̀yin, àwọn."),
    ("Interrogatives 'Kí ni?' and 'Ṣé?'", "Kí ni…? asks 'what is…?' (Kí ni orúkọ rẹ? 'What is your name?'). Ṣé turns a statement into a yes/no question: Ṣé dáadáa ni? 'Are you fine?' Answer with bẹ́ẹ̀ ni (yes) or bẹ́ẹ̀ kọ́ / ó tì (no)."),
   ]),
 2: dict(yo="Orí Kejì", en="My Classroom",
   lessons=[
    ("Possessive Pronouns", "Possessives follow the noun, whose final vowel lengthens: ìwéè mi 'my book', iléè rẹ̀ 'his/her house'. Forms: mi (my), rẹ/ẹ (your sg.), rẹ̀/ẹ̀ (his/her/its), wa (our), yín (your pl.), wọn (their). Wọn and yín also mark respect for elders and superiors."),
    ("The plural marker 'àwọn'", "Nouns do not change form for number. Plurality is shown by placing àwọn before the noun: àwọn ìwé 'books', àwọn akẹ́kọ̀ọ́ 'students'."),
    ("Nínú Kíláàsì (In the Classroom)", "Classroom objects and commands. The preposition ní 'in/at/on' contracts with nouns: ní + inú → nínú 'inside', ní + ilé → nílé 'at home'. Common commands: dìde 'stand up', jókòó 'sit down', tẹ́tí sílẹ̀ 'listen'."),
    ("Nọ́ńbà (Numbers 0–40)", "Counting forms: oókan (1), eéjì (2), ẹẹ́ta (3), ẹẹ́rin (4), aárùnún (5), ẹẹ́fà (6), eéje (7), ẹẹ́jọ (8), ẹẹ́sànán (9), ẹẹ́wàá (10)… ogún (20), ọgbọ̀n (30), ogójì (40). Qualifying numerals take m-: ìwé mẹ́ta 'three books'."),
   ]),
 3: dict(yo="Orí Kẹta", en="Mark the Date",
   lessons=[
    ("Nọ́ńbà (Numbers 40–100)", "Yorùbá counts in twenties: ogójì (40), àádọ́ta (50 = 60−10), ọgọ́ta (60), àádọ́rin (70), ọgọ́rin (80), àádọ́rùnún (90), ọgọ́rùnún (100). Tens between are formed by subtraction from the next twenty."),
    ("Future Tense 'máa'", "The future is marked with máa (or yóò) before the verb: Màá lọ / Èmi máa lọ 'I will go'; Wọ́n máa jẹun 'They will eat'."),
    ("Days of the Week", "The seven days: Ọjọ́ Àìkú (Sunday), Ọjọ́ Ajé (Monday), Ọjọ́ Ìṣẹ́gun (Tuesday), Ọjọ́rú (Wednesday), Ọjọ́bọ̀ (Thursday), Ọjọ́ Ẹtì (Friday), Ọjọ́ Àbámẹ́ta (Saturday). Ọjọ́ 'day' precedes most names."),
    ("Months of the Year (Kàlẹ́ńdà Yorùbá)", "Months use oṣù 'month' + ordinal: Oṣù Kìíní 'January (first month)', Oṣù Kejì 'February', … Oṣù Kejìlá 'December (twelfth month)'."),
   ]),
 4: dict(yo="Orí Kẹrin", en="What Time Do We Meet?",
   lessons=[
    ("The Interrogative 'Mélòó'", "Mélòó asks 'how many?' after a (singular) noun: Ìwé mélòó? 'How many books?' Answers use qualifying numerals: ìwé mẹ́ta 'three books'."),
    ("Aago mélòó ni ó lù? (What time is it?)", "Time is asked with Aago mélòó ni ó lù? 'What time has struck?' Answers: aago méje (7 o'clock); ààbọ̀ 'half past' (aago méje àábọ̀); ìṣẹ́jú 'minute' with lé 'past' and kù 'to': ó ku ìṣẹ́jú mẹ́wàá kí aago mẹ́jọ 'ten to eight'."),
    ("Asking for Age", "Age uses ọdún 'year': Ọmọ ọdún mélòó ni ọ́? 'How old are you?' — Ọmọ ọdún mẹ́rìndínlógún ni mí 'I am sixteen years old'."),
    ("Àwọn Àwọ̀ (Colors)", "Core color terms: funfun 'white', dúdú 'black/dark', pupa 'red/light-complexioned'. Other colors are described with phrases, e.g. àwọ̀ ewé 'leaf-colored (green)', àwọ̀ ọ̀run 'sky-colored (blue)'."),
   ]),
 5: dict(yo="Orí Karùnún", en="My Family Tree",
   lessons=[
    ("The verbs 'jẹ́' and 'ni' (to be)", "Both mean 'to be'. Ni is equative and follows the complement: Olùkọ́ ni mí 'I am a teacher'. Jẹ́ precedes the complement: Mo jẹ́ olùkọ́. The negation of ni is kọ́: Olùkọ́ kọ́ ni mí 'I am not a teacher'."),
    ("The interrogative 'Ta ni'", "Ta ni…? asks 'who is…?': Ta ni èyí? 'Who is this?' — Bàbáà mi ni 'It is my father'."),
    ("Ẹbí ní ìdílé Mẹ́ta (Three Generations of a Family)", "Family terms: bàbá 'father', ìyá/màmá 'mother', ẹ̀gbọ́n 'older sibling', àbúrò 'younger sibling' (no gender distinction), ọmọ 'child', ìyá àgbà 'grandmother', bàbá àgbà 'grandfather'. Seniority, not gender, organizes sibling terms."),
    ("Describing People", "Descriptive verbs/adjectives: ga 'be tall', kúrú 'be short', tóbi 'be big', kéré 'be small', sanra 'be fat', tínrín 'be thin'; used directly as predicates: Ó ga 'He/she is tall'."),
   ]),
 6: dict(yo="Orí Kẹfà", en="Shop With Me",
   lessons=[
    ("Interrogative 'Eélòó'", "Eélòó asks 'how much?': Eélòó ni? 'How much is it?' — Ogún náírà ni 'It is twenty naira (₦20)'."),
    ("Oní-/Al-/Ẹl-/Ọl- (owner/seller prefix)", "The prefix oní- 'owner/seller of' assimilates to the noun's first vowel: oní + ata → aláta 'pepper seller'; oní + ẹja → ẹlẹ́ja 'fish seller'; oní + ọtí → ọlọ́tí 'drink seller'; before i/consonant it stays oní-: oníṣòwò 'trader'."),
    ("Níná Ọjà (Haggling)", "Market bargaining: Eélòó ni? 'how much?', Ó wọ́n jù 'it is too expensive', Dín owó rẹ̀ kù 'reduce the price', Mo fẹ́ raà á 'I want to buy it'."),
    ("Nọ́ńbà (Numbers 100–3000)", "Large numbers: ọgọ́rùnún (100), igba (200), ọ̀ọ́dúnrún (300), irinwó (400), ẹ̀ẹ́dẹ́gbẹ̀ta (500), ẹgbẹ̀ta (600), ẹgbẹ̀rún (1000), ẹgbàá (2000), ẹgbẹ̀ẹ́dógún (3000)."),
   ]),
 7: dict(yo="Orí Keje", en="Let's Find Something to Eat!",
   lessons=[
    ("Verbs 'fẹ́' and 'fẹ́ràn'", "Fẹ́ = 'to want' (also 'to love'); fẹ́ràn = 'to like/love'. Fẹ́ + verb expresses 'want to': Mo fẹ́ jẹun 'I want to eat'. Mo fẹ́ràn ìrẹsì 'I like rice'."),
    ("Àwọn oúnjẹ òòjọ́ (Daily meals)", "Meals: oúnjẹ àárọ̀ 'breakfast', oúnjẹ ọ̀sán 'lunch', oúnjẹ alẹ́ 'dinner'. Hunger and thirst are expressed with 'pa' and 'gbẹ': Ebi ń pa mí 'I am hungry', Òùngbẹ ń gbẹ mí 'I am thirsty'."),
    ("In the Market", "Buying and selling food: ra 'to buy', ta 'to sell', ọjà 'market'. Mo fẹ́ ra ẹja 'I want to buy fish'. Names of staple foods: iṣu 'yam', ìrẹsì 'rice', ẹ̀wà 'beans', ọ̀gẹ̀dẹ̀ 'banana/plantain'."),
    ("Rírà oúnjẹ nínúu búkà (Ordering food in a restaurant)", "In a búkà (local restaurant): Kí ni ẹ ní? 'What do you have?', Fún mi ní… 'Give me…', Mo fẹ́ jẹ iṣu àti ẹyin 'I want to eat yam and eggs'."),
   ]),
 8: dict(yo="Orí Kẹjọ", en="Are You Feeling Good Today?",
   lessons=[
    ("Possessive forms of emphatic pronouns", "Ti + possessive gives 'mine/yours/…': tèmi 'mine', tìrẹ 'yours (sg.)', tirẹ̀ 'his/hers/its', tiwa 'ours', tiyín 'yours (pl.)', tiwọn 'theirs': Ìwé yìí tèmi ni 'This book is mine'."),
    ("Parts of the Body", "Body parts: orí 'head', ojú 'eye/face', imú 'nose', ẹnu 'mouth', etí 'ear', ọrùn 'neck', apá 'arm', ọwọ́ 'hand', ikùn 'stomach', ẹsẹ̀ 'leg/foot', orúkún 'knee', ìka 'finger/toe'."),
    ("Ìlera àti àìsàn (Health and illness)", "Talking about health: Ara mi ń ro mí 'my body aches', orí ń fọ́ mi 'I have a headache', inú ń run mí 'I have a stomachache'. Àìsàn 'illness', ìlera 'health', dókítà 'doctor', oògùn 'medicine'."),
    ("Eré Ìdárayá (Sports)", "Sports and exercise: eré ìdárayá 'sports/recreation', gba bọ́ọ̀lù 'play ball', sáré 'run', wẹ̀ 'swim/bathe'. Máa followed by verb also expresses habitual future activity."),
   ]),
 9: dict(yo="Orí Kẹsànán", en="My Work Place",
   lessons=[
    ("Verbs for Professions", "Professions use jẹ́ or ṣe + occupation: Mo jẹ́ dókítà / Mo ń ṣiṣẹ́ dókítà 'I am a doctor / I work as a doctor'. Ń ṣiṣẹ́ = 'is working'."),
    ("Negation: 'kò tí ì' / 'kò ì tí ì'", "Kò tí ì (or kò ì tí ì) + verb means 'has not (yet)': Kò tí ì dé 'He/she has not yet arrived'; Wọn kò ì tí ì jẹun 'They have not yet eaten'."),
    ("Professions", "Many profession nouns are derived with prefixes a- or oní-: akọ̀wé 'clerk/secretary', agbẹ̀ 'farmer', oníṣòwò 'trader', awakọ̀ 'driver', olùkọ́ 'teacher', dókítà 'doctor', lọ́yà 'lawyer'."),
   ]),
 10: dict(yo="Orí Kẹwàá", en="Home Sweet Home!",
   lessons=[
    ("Ordinals", "Ordinals prefix k- to the numeral: kìíní 'first', kejì 'second', kẹta 'third', kẹrin 'fourth'… Ilé kìíní 'the first house'. Noun forms take è-/ì-: èkínní, èkejì."),
    ("Reflexives and Vowel Processes", "Reflexives use ara + possessive: ara mi 'myself', ara rẹ̀ 'himself/herself'. Yorùbá speech shows vowel assimilation (ilé + ẹ̀ → iléè), vowel lengthening in possessive constructions, and vowel deletion in rapid speech (kí + ó → kó)."),
    ("Ilée wa (Our House) I", "Rooms and parts of the house: yàrá 'bedroom', pálọ̀ 'parlor/living room', ilé ìdáná 'kitchen', balùwẹ̀ 'bathroom', ilé ìgbọ̀nsẹ̀ 'toilet', ọgbà 'yard/garden', ilẹ̀kùn 'door', fèrèsé 'window'."),
    ("Ilée wa (Our House) II", "Describing housing, old and new: traditional agboolé 'family compound' versus modern houses; positions with ní: òkè 'upstairs/top', ìsàlẹ̀ 'downstairs/bottom'."),
   ]),
 11: dict(yo="Orí Kọkànlá", en="Nice Style!",
   lessons=[
    ("Aṣọ wíwọ̀ ní ilẹ̀ẹ Yorùbá (Types of Clothing)", "Traditional dress: bùbá 'blouse/shirt', ìró 'wrap skirt', gèlè 'head-tie', ṣòkòtò 'trousers', agbádá 'flowing gown', fìlà 'cap', bàtà 'shoes'."),
    ("More Interrogatives", "Further question words: Irú … wo? 'which kind of…?', Níbo? 'where?', Báwo? 'how?': Irú aṣọ wo ni o fẹ́? 'Which kind of cloth do you want?'"),
    ("Clothing Verbs: fi…lé/kọ́, wọ̀, dé, wé, ró, gẹ̀", "Different verbs for wearing different items: wọ̀ 'wear (body/feet)' — wọ aṣọ/bàtà; dé 'wear (on head)' — dé fìlà; wé 'tie (head-tie)' — wé gèlè; ró 'wrap (skirt)' — ró ìró; fi…lé/kọ́ 'put/hang on'."),
    ("Seasonal Clothings", "Clothing follows the seasons: heavy cloth (aṣọ tí ó wúwo) for òtútù 'the cold/rainy season', light cloth (aṣọ fẹ́lẹ́fẹ́lẹ́) for ẹ̀rùn 'the dry/hot season'."),
   ]),
 12: dict(yo="Orí Kejìlá", en="Campus Life",
   lessons=[
    ("Ilé-Ìwé (School System)", "School vocabulary: ilé-ìwé 'school', ilé-ìwé alákọ̀ọ́bẹ̀rẹ̀ 'primary school', ilé-ìwé girama 'secondary school', yunifásítì/fásitì 'university', akẹ́kọ̀ọ́ 'student', olùkọ́ 'teacher'."),
    ("University Course Schedules", "Talking about courses and schedules: combining days of the week, times, and subjects: Mo ní kíláàsì Yorùbá ní aago mẹ́sànán ní ọjọ́ Ajé 'I have Yorùbá class at 9 on Monday'."),
    ("Facilities", "Campus facilities: ilé-ìkàwé 'library', láàbù 'laboratory', gbọ̀ngàn 'hall', ilé oúnjẹ 'cafeteria', pápá ìṣeré 'sports field'."),
    ("Campus Life", "Describing daily life on campus: classes, studying (kàwé 'to read/study'), friends, and activities, combining the chapter's vocabulary with earlier grammar."),
   ]),
}

def parse_objectives(cover):
    m = re.search(r'you will learn:(.*)', cover.replace('\n',' '), re.S|re.I)
    if not m: return []
    tail = m.group(1)
    tail = re.sub(r'\s*\d+\s*$','',tail).strip()
    parts = [p.strip(' .') for p in re.split(r'\s*-\s?(?=[A-ZÀ-ỹẸỌṢÌÒ‘How|About|The])', ' '+tail) if p.strip()]
    parts = [p.strip(' .') for p in re.split(r'(?:^|\s)-\s?', tail) if len(p.strip(' .'))>3]
    return parts

chapters = []
for ch in range(1, 13):
    e = ex[str(ch)]
    meta = CHAPTERS[ch]
    items = []
    for i, v in enumerate(e['vocab'], 1):
        yo = v['yo'].strip(); en = re.sub(r'\s+',' ',v['en']).strip()
        if not yo or not en: continue
        items.append({"id": f"c{ch}-v{i}", "type": "vocab", "pos": v['pos'],
                      "yo": yo, "en": en})
    for j, (title, expl) in enumerate(meta['lessons'], 1):
        exs = e['lesson_examples'][j-1] if j-1 < len(e['lesson_examples']) else []
        items.append({"id": f"c{ch}-g{j}", "type": "grammar", "lesson": j,
                      "title": title, "explanation": expl,
                      "examples": [{"yo": p['yo'], "en": re.sub(r'\s+',' ',p['en']).strip()} for p in exs]})
    chapters.append({
        "id": ch, "yorubaTitle": meta['yo'], "title": meta['en'],
        "objectives": parse_objectives(e['cover']), "items": items,
    })

content = {
  "meta": {
    "title": "Yorùbá Yé Mi — A Beginning Yorùbá Textbook",
    "author": "Fẹ̀hìntọ́lá Mosádomi, Ph.D — COERLL, The University of Texas at Austin (2012)",
    "license": "Creative Commons (CC 2012)",
    "isbn": "978-1937963-02-6",
    "extractionNotes": [
      "The PDF uses a legacy 'YorubaSans' font with no Unicode mapping; all Yorùbá diacritics (ọ, ẹ, ṣ, tone marks) were recovered via an empirically derived character map (see decode.py). Spot-checked across all 12 chapters, but isolated mis-decoded characters may remain.",
      "Vocabulary was extracted positionally from the two-column 'Àwọn ọ̀rọ̀' tables of each chapter (1,008 entries). English glosses that wrapped across lines were rejoined automatically.",
      "Grammar explanations are concise summaries written from each lesson's content; example sentences are harvested verbatim from the book's two-column example tables. Lessons that are mostly dialogue/exercise pages yielded few or no machine-extractable example pairs (notably ch. 7–9, 12 later lessons).",
      "Dialogues (Ìsọ̀rọ̀ngbèsì) and in-book exercises (Iṣẹ́ Ṣíṣe) were not separately structured; the app generates its own drills from vocab + grammar items instead.",
      "The book's Introduction (alphabet, tones, pronunciation) is included as reference material, not as a gated chapter.",
      "The textbook has no bundled audio; COERLL hosts audio for this book online, but the app is offline-first so listening drills are omitted."
    ]
  },
  "intro": {
    "title": "Introduction: The Sounds of Yorùbá",
    "notes": [
      "Yorùbá has 7 oral vowels: a, e, ẹ (as in 'bet'), i, o, ọ (as in 'bought'), u — plus nasal vowels: an, ẹn, in, ọn, un.",
      "Three tones distinguish word meanings: High (á, marked ´), Mid (a, unmarked), Low (à, marked `). Example: bí 'to give birth', bi 'to ask', bì 'to vomit'.",
      "Consonants include gb (a single sound, pronounced together), ṣ (like English 'sh'), p (pronounced [kp]), and j (like English 'j'). There is no c, q, v, x or z.",
      "The syllabic nasals ń/ǹ can form syllables on their own and carry tone, e.g. ń in Ó ń lọ 'He is going'."
    ]
  },
  "chapters": chapters
}

json.dump(content, open('content.json','w'), ensure_ascii=False, indent=1)
nv = sum(1 for c in chapters for i in c['items'] if i['type']=='vocab')
ng = sum(1 for c in chapters for i in c['items'] if i['type']=='grammar')
print(f"content.json written: {len(chapters)} chapters, {nv} vocab items, {ng} grammar items")
