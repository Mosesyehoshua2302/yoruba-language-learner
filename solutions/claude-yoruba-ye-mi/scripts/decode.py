# Legacy YorubaSans font -> Unicode Yoruba decode map (derived empirically)
MAP = {
 'æ':'ọ','Æ':'Ọ','ö':'ọ̀','Ö':'Ọ̀','ô':'ọ́','Ô':'Ọ́',
 '÷':'ẹ','¿':'Ẹ','ë':'ẹ̀','Ë':'Ẹ̀','ê':'ẹ́','Ê':'Ẹ́',
 '«':'ṣ','»':'Ṣ','ñ':'ń','Ñ':'Ń','õ':'ń','Õ':'Ǹ',
 '‚':',','¥':'₦','':'→','':'←','☐':'',
}
def decode(s):
    return ''.join(MAP.get(c,c) for c in s)
