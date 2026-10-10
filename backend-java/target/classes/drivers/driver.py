def __ser(v):
    if '__RET__' == 'double':
        return '%.5f' % float(v)
    if '__RET__' == 'bool':
        return 'true' if v else 'false'
    return json.dumps(v, separators=(',', ':'))


__lines = sys.stdin.read().split('\n')
__n = int(__lines[0])
__idx = 1
for __i in range(__n):
    __args = [json.loads(__lines[__idx + __j]) for __j in range(__K__)]
    __idx += __K__
    print('@@CASE@@', flush=True)
    __r = Solution().__FN__(*__args)
    print('@@RESULT@@' + __ser(__r), flush=True)
