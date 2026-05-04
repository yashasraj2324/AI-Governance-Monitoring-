import fs from 'fs';

async function test() {
  try {
    const res = await fetch('http://localhost:3000/api/assess_doesntexist', {
      method: 'POST',
      body: 'test',
    });
    console.log('Status', res.status);
    console.log('Headers', res.headers.get('content-type'));
    const text = await res.text();
    console.log('Body:', text.substring(0, 200));
  } catch (e) {
    console.error(e);
  }
}

test();
