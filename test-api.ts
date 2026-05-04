import fs from 'fs';

async function test() {
  try {
    const fileBuf = fs.readFileSync('public/sample-model-card.txt');
    const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
    
    let body = '--' + boundary + '\r\n';
    body += 'Content-Disposition: form-data; name="file"; filename="sample-model-card.txt"\r\n';
    body += 'Content-Type: text/plain\r\n\r\n';
    body += fileBuf.toString('utf8') + '\r\n';
    body += '--' + boundary + '--\r\n';

    const res = await fetch('http://localhost:3000/api/assess', {
      method: 'POST',
      headers: {
        'Content-Type': 'multipart/form-data; boundary=' + boundary
      },
      body: body,
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
