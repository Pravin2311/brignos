const fs = require('fs');

// Input NameBio-style dataset
const sales = JSON.parse(
  fs.readFileSync(
    './data/namebio-sales.json',
    'utf8'
  )
);

const lengthCounts = {};
const bigramCounts = {};
const endingCounts = {};
const startCounts = {};
const vowelRatios = [];

function addCount(map,key){
  if(!key) return;
  map[key] = (map[key] || 0) + 1;
}

for(const sale of sales){

  const domain =
    (sale.domain || '')
    .toLowerCase()
    .replace(/\.(com|io|ai|co|xyz|net|org)$/,'');

  if(!domain) continue;

  // Length
  const len = domain.length;
  addCount(lengthCounts,len);

  // Starts
  addCount(
    startCounts,
    domain.substring(0,2)
  );

  // Endings
  addCount(
    endingCounts,
    domain.slice(-2)
  );

  // Bigrams
  for(let i=0;i<domain.length-1;i++){

    const bg =
      domain.substring(i,i+2);

    addCount(
      bigramCounts,
      bg
    );

  }

  // Vowel ratio
  const vowels =
    (domain.match(/[aeiou]/g)||[])
    .length;

  vowelRatios.push(
    vowels/domain.length
  );

}

// Helpers

function topKeys(map,count=25){

  return Object.entries(map)
    .sort((a,b)=>b[1]-a[1])
    .slice(0,count)
    .map(x=>x[0]);

}

function average(arr){

  return arr.reduce(
    (a,b)=>a+b,0
  ) / arr.length;

}

const intelligence = {

  generated:
    new Date().toISOString(),

  domain_count:
    sales.length,

  preferred_lengths:
    topKeys(lengthCounts,10)
      .map(Number),

  preferred_bigrams:
    topKeys(bigramCounts,50),

  preferred_endings:
    topKeys(endingCounts,30),

  preferred_starts:
    topKeys(startCounts,30),

  avg_vowel_ratio:
    Number(
      average(vowelRatios)
      .toFixed(3)
    )

};

fs.writeFileSync(
  './data/sales-intelligence.json',
  JSON.stringify(
    intelligence,
    null,
    2
  )
);

console.log(
  'sales-intelligence.json created'
);

console.log(
  'Domains:',
  sales.length
);