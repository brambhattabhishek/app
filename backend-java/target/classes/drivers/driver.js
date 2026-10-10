const __lines = require('fs').readFileSync(0, 'utf8').split('\n');
const __ser = (v) => __SER__;
let __idx = 1;
const __n = parseInt(__lines[0]);
for (let __i = 0; __i < __n; __i++) {
  const __a = [];
  for (let __j = 0; __j < __K__; __j++) __a.push(JSON.parse(__lines[__idx++]));
  console.log('@@CASE@@');
  console.log('@@RESULT@@' + __ser(__FN__(...__a)));
}
