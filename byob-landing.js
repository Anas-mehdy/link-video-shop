/* Link Store bundle builder. The expanded catalogue belongs to the public Salla content page. */
(function () {
'use strict';
if (window.__linkByobBootstrapInstalled) return;
window.__linkByobBootstrapInstalled = true;

const linkBundleLegacy = [
  {"id":207290951,"title":"كفر سليم شفاف","group":"covers","model":"iPhone 18 Pro Max","max":3,"image":"https://cdn.salla.sa/Zpqzp/e2959c25-6a9b-4ff4-aaff-c781c58529f2-120x120-kCkSkPb9s0IqzgdsyUH2DWdD1qr4s6Cp5hwFJWoe.png"},
  {"id":671957057,"title":"شاحن لنك الجداري 45W","group":"chargers","model":"","max":2,"image":"https://cdn.salla.sa/Zpqzp/267bcbd1-d1c8-4144-9457-8dd750a1decd-120x120-HcbZq5GVkA74PuUZnGsKLfNlygTwD9QD14qiA6oQ.jpg"},
  {"id":1471188547,"title":"وصلة Link بطول مترين","group":"cables","model":"USB-C إلى Lightning","max":3,"image":"https://cdn.salla.sa/Zpqzp/ceaec308-c657-4f04-8c9d-fc2cda7e0203-120x120-x9mFNIojI3If7dXgu6OmtdZZZqATItwoVDYsEn2Z.png"}
];
const linkBundleCatalog = [
  {"title":"استيكر شاشة لامع","group":"screens","products":[{"id":1794976574,"model":"iPhone 17 Pro","image":"https://cdn.salla.sa/Zpqzp/3f7f94be-cbff-4f95-945a-a7b68373c153-96.6x120-10esRFfDr8mBHRvX6h35arb27fef4TstudwVmjzq.png","available":false,"limit":0},{"id":37648393,"model":"iPhone 17 Pro Max","image":"https://cdn.salla.sa/Zpqzp/b7d458f9-9002-43fd-a845-47defcb33199-96.6x120-FCVJZEbWyCrddtud7bYwwvUjxeJjAL0MZ8oQz9nN.png","available":false,"limit":0},{"id":96867078,"model":"iPhone 16 Pro","image":"https://cdn.salla.sa/Zpqzp/8157a925-c4ec-41f7-9bf4-198e27a9f551-120x120-mkjtoIlvZ3wXU11FuNWUkHqcdHliw7vWMTGWHJsm.png","available":false,"limit":0},{"id":1718893071,"model":"iPhone 16 Pro Max","image":"https://cdn.salla.sa/Zpqzp/f73655c1-585b-4bd5-96a7-3b0e1c53570f-120x120-8llrpvmm8Zvl6PNq30QcUAWuGXrHuI5sBfZ4wY5Q.png","available":false,"limit":0}]},
  {"title":"استيكر شاشة لامع خصوصي","group":"screens","products":[{"id":1934979073,"model":"iPhone 17 Pro","image":"https://cdn.salla.sa/Zpqzp/7435f9f8-1902-425e-80eb-8c9e1f5b2dd2-96.6x120-tEKncMRsJQANSTDuyli1J6BDmXbZhxsOBpNjYM0l.png","available":false,"limit":0},{"id":1295228674,"model":"iPhone 16 Pro","image":"https://cdn.salla.sa/Zpqzp/2c00ebbb-a0aa-4e4b-905b-3864e3816ed4-120x120-pUGzSZbG11sERcH65SPpXPddjDKjsVYBQAyKxTu2.png","available":false,"limit":0}]},
  {"title":"استيكر شاشة مطفي خصوصي","group":"screens","products":[{"id":562581760,"model":"iPhone 17 Pro","image":"https://cdn.salla.sa/Zpqzp/f7c24af7-e362-4045-a7db-3ecf37b6ac94-96.6x120-YCmWdY2hC2LgatNH521Z6DWiMTcNn0SgNPeAA1f1.png","available":false,"limit":0},{"id":985857037,"model":"iPhone 17 Pro Max","image":"https://cdn.salla.sa/Zpqzp/3f6950d6-5a05-48ab-befe-42a412243b15-96.6x120-nBkPJWEcOyo2MbxQKeBJFV698QO4BVb9Nck1dtov.png","available":false,"limit":0},{"id":1470312967,"model":"iPhone 16 Pro","image":"https://cdn.salla.sa/Zpqzp/5b593430-de00-46cc-9ead-f90e29bb51dc-120x120-e1a0ddUHSfNSuxYmVyCISb92eidu6zFtmf30vsuu.png","available":false,"limit":0},{"id":1437328405,"model":"iPhone 16 Pro Max","image":"https://cdn.salla.sa/Zpqzp/7f4e4554-90d0-4d2f-9311-f67db556d008-120x120-4Y2BunOSaCMV1j9A6L3DEFUT6sUT7PBU9tZt6qWS.png","available":false,"limit":0}]},
  {"title":"استيكر شاشة مطفي","group":"screens","products":[{"id":521715203,"model":"iPhone 17 Pro","image":"https://cdn.salla.sa/Zpqzp/15084355-16e7-4ade-88c8-c782f90cbd88-96.6x120-9TQRK0YR7DbZka0y2Mcv6AgcFHnwg9qu4scBy9U5.png","available":false,"limit":0},{"id":661652246,"model":"iPhone 17 Pro Max","image":"https://cdn.salla.sa/Zpqzp/68af8515-e2ff-4f0a-a5d1-df598d53aeb7-96.6x120-IlMSe2Bdtn4FlTT5BsB8pqLbsxT7skt0cONdbnfb.png","available":false,"limit":0},{"id":1759894796,"model":"iPhone 16 Pro","image":"https://cdn.salla.sa/Zpqzp/ee6c627c-4568-41c7-894b-e42724683212-120x120-WyUuZu7HTWAnMo1RQCNiRpuE56m1ZFn1GT8gd8zc.png","available":false,"limit":0},{"id":1901928983,"model":"iPhone 16 Pro Max","image":"https://cdn.salla.sa/Zpqzp/8e7feae1-183f-40a2-9190-e430ab7128c1-120x120-kQZHgpdJBQdiDnI6k97pnhwCt4gkkfszTojwsJFw.png","available":false,"limit":0}]},
  {"title":"عدسات حماية كاميرا iPhone","group":"lenses","products":[{"id":648922132,"model":"iPhone 17 Pro","image":"https://cdn.salla.sa/Zpqzp/2f350976-eb87-4073-a756-7b8355cab328-120x120-VfA63O7S5rSmATDdcyh7lVpSl1MWSs6YJw1RSL2X.webp","available":false,"limit":0,"colors":[{"name":"أورانج","image":"https://cdn.salla.sa/Zpqzp/f082a926-30fd-4b9e-868e-3bd8ebdac9e5-500x500-IcdxbWLEB0zfkVDOZuAbwIHkfTMvr8RXsfe91Ltm.webp"}]},{"id":1739173139,"model":"iPhone 17 Pro Max","image":"https://cdn.salla.sa/Zpqzp/b92e7540-9fc5-4305-b8e6-d3c4b4ab6bc1-120x120-LoDl5NGqF0fZKfrWDKAjRwiENz2hf8mvE11ieHfH.webp","available":false,"limit":0,"colors":[{"name":"أورانج","image":"https://cdn.salla.sa/Zpqzp/e2a9be22-83b0-4908-8a07-c059184a49f6-500x500-NypOZpT8xmY7YMNrkDE77sJ1Arm5XOedAOAtZInf.webp"}]}]},
  {"title":"عدسات حماية كاميرا سامسونج","group":"lenses","products":[{"id":613709338,"model":"Galaxy S25 Ultra","image":"https://cdn.salla.sa/Zpqzp/0bfab0fd-9026-4255-a37a-d9704e72dfad-120x120-x26K275c1SgTJyf4HfJbdDdGUcwd4bFgaVSOxHMO.png","available":false,"limit":0,"colors":[{"name":"وردي"},{"name":"أسود"},{"name":"فضي"},{"name":"تيتانيوم"}]}]},
  {"title":"إطار Link المعدني","group":"frames","products":[{"id":1137281694,"model":"iPhone 17 Pro","image":"https://cdn.salla.sa/Zpqzp/e6765af6-c7e5-40cc-88e0-00eb8c1669ea-120x120-9DklsrQJARsxNJL1yhL8pz47J9r0EDT3xRZUzO8a.jpg","available":false,"limit":0,"colors":[{"name":"أورانج","image":"https://cdn.salla.sa/Zpqzp/fa09fbfd-e1a1-4b8e-a9d3-85efe2795a0b-500x500-LN5HmqImzS4JCZ25eWzc4jAjpyKSeWW1CRstlFP7.png","options":{"1252483623":474084231},"limit":8,"available":false},{"name":"كحلي","image":"https://cdn.salla.sa/Zpqzp/437bed25-9488-463c-9343-1971bdd6c6d4-500x500-b0gAFoqAOkJJIDgOVaWpqKFBOZgZqDtmbnUdcf6g.png","options":{"1252483623":625508880},"limit":8,"available":false},{"name":"تيتانيوم","image":"https://cdn.salla.sa/Zpqzp/17eb9cd1-391c-472b-8694-3efe2006d01b-500x500-2B4Coy4xuzKmiW1cpO2lZpfCRgiJ4tEcfV8c47JC.png","options":{"1252483623":1264739095},"limit":8,"available":false}]},{"id":1004957457,"model":"iPhone 17 Pro Max","image":"https://cdn.salla.sa/Zpqzp/ac6e2296-7eab-4dcc-b50f-41d8afdb4c50-120x120-zUACR1halYlYBILN6h6B1xDOMTSXzJAszteUGWjm.jpg","available":false,"limit":0,"colors":[{"name":"أورانج","image":"https://cdn.salla.sa/Zpqzp/7f0b7062-9e0f-4bea-ab79-9ca1f4d0ea11-500x500-280Ravq4AkmRaWJlSWacFuMzyOhYq9LEUALItnCQ.png","options":{"839757132":470613507},"limit":8,"available":false},{"name":"تيتانيوم","image":"https://cdn.salla.sa/Zpqzp/71a36100-6dde-4e37-b5c7-23f93fdf0f5e-500x500-udVBSrdYiVpuwWWEkEYHmiCcB8hQor8Q62yP52JX.png","options":{"839757132":1735948815},"limit":8,"available":false},{"name":"كحلي","image":"https://cdn.salla.sa/Zpqzp/77647b7e-0c9a-42e9-b823-e98dd2c2e068-500x500-ONEgKrh2lWTqQO3nZycwjM8QCv2wo7OQ9uazaMlJ.png","options":{"839757132":826710280},"limit":8,"available":false}]},{"id":1563953694,"model":"iPhone 16 Pro","image":"https://cdn.salla.sa/Zpqzp/367a8f0f-0ac7-4c2d-a663-8688d57d5382-120x120-Fh8MhpJbaahE1XLMIvDErECaXJ7cul73vmVUWM1Y.png","available":false,"limit":0,"colors":[{"name":"تيتانيوم","image":"https://cdn.salla.sa/Zpqzp/63d33dd5-ec26-40bb-b4e2-5aaefeba7783-500x500-qmjmVjzPOMPLWrx4kzX27w2zRE2kOg5y7qlgfYTH.png","options":{"267045965":1776885004},"limit":8,"available":false},{"name":"ذهبي","image":"https://cdn.salla.sa/Zpqzp/485013ed-bdc1-4ef0-ab78-66bd0fc8b41c-500x500-tgsL93zv4eFPTp60zpZTgvb5k7NTfbbXS2k2d63S.png","options":{"267045965":52672521},"limit":8,"available":false},{"name":"أسود","image":"https://cdn.salla.sa/Zpqzp/ce25a817-ec9b-4b28-a30c-ad25cfae92d3-500x500-mR0d4Q6i7WZFth46cXYx2862ijiulgfcdVYv4QXW.png","options":{"267045965":1560856330},"limit":8,"available":false}]},{"id":1421911307,"model":"iPhone 16 Pro Max","image":"https://cdn.salla.sa/Zpqzp/e068e9f6-187c-462c-a9cb-01e04cbe69fe-120x120-FovnKNw64J6DeJCsKZKH42q77o8zUB0eedrFVmCV.png","available":false,"limit":0,"colors":[{"name":"تيتانيوم","image":"https://cdn.salla.sa/Zpqzp/ea12cc48-4960-4018-8edc-20fdae561c05-500x500-0rg2EtttjwEapHrXhLjDyiY765INwMIJR2OyuSug.png"},{"name":"ذهبي","image":"https://cdn.salla.sa/Zpqzp/600dc33a-dd35-4231-bb41-27bfff2aee94-500x500-tFLa7mX0kbFgaUkLwASAskrPYS3jm15EaZXCRoY3.png"},{"name":"أسود","image":"https://cdn.salla.sa/Zpqzp/3e2c42c4-96c0-4d44-b8f5-e2dd31b37580-500x500-5oeP4jsD9B3p0nhxfunrhT6mtfVPQVtH1p82kfuW.png"}]},{"id":1112998422,"model":"iPhone 16 Plus","image":"https://cdn.salla.sa/Zpqzp/8f458a31-938a-43a7-ba00-facaf31b1c88-120x120-y38dvTMfGR2VnAHeHrE6PcphDd0o2t4oDMSZBbjb.png","available":false,"limit":0,"colors":[{"name":"أزرق","image":"https://cdn.salla.sa/Zpqzp/67d706bc-32bb-4f91-b24d-94115a2b54af-500x500-4ZkRnmyF6fNloIpFXgoJuBVi9TxM0aestMbQOgmq.png","options":{"1505225550":1001798669},"limit":8,"available":false},{"name":"أخضر","image":"https://cdn.salla.sa/Zpqzp/dbf8ab10-472a-4fe9-81c7-a73a2d73464b-500x500-YtFHSwE8La6B02Y3MiErI2wCiFjFR3wFFTw6kiXg.png","options":{"1505225550":944006539},"limit":8,"available":false},{"name":"وردي","image":"https://cdn.salla.sa/Zpqzp/a5a4f2cb-4cb7-4fb3-856b-0ac9dd1723e3-500x500-i77fwG63RIPr1HtM0VryOdowSO0zr7ede7CZKqL6.png","options":{"1505225550":170034324},"limit":8,"available":false},{"name":"أسود","image":"https://cdn.salla.sa/Zpqzp/ea654afb-ad78-4087-8ae6-f3da58ad5bcd-500x500-Hs0cGL8P8zZVvgDBy2DW6JPeo7q51c1Uk8LCBD0U.png","options":{"1505225550":1678746517},"limit":8,"available":false},{"name":"فضي","image":"https://cdn.salla.sa/Zpqzp/8181ea1d-a523-420b-9f96-eec862b9ea9d-500x500-hoeb0KD7TIAmHJQ2XTUQBYV4wox8uJDJYNMRcSP7.png","options":{"1505225550":836027030},"limit":8,"available":false}]},{"id":1255102233,"model":"iPhone 16","image":"https://cdn.salla.sa/Zpqzp/b64a858f-c1a5-4ea1-9717-0f3483895462-120x120-ahgnlUVJOJ7Uk2IFzUX0DDEUMG9sIJMxhk7pmTok.png","available":false,"limit":0,"colors":[{"name":"أخضر","image":"https://cdn.salla.sa/Zpqzp/92377386-0b78-4f89-af10-af95d392167c-500x500-7iBCKAG8z2gG8z1RycOK964GKh6bB5NBSyjHtolD.png"},{"name":"وردي","image":"https://cdn.salla.sa/Zpqzp/9994dbd7-5519-4896-93fa-12991a8df4ee-500x500-tgudQgvoil2HXbEHOh78r1EfTgaTO4q2qRE68CBh.jpg"},{"name":"فضي","image":"https://cdn.salla.sa/Zpqzp/71121bfa-3b29-4286-9887-1ade4e4d2da8-500x500-46qiJX0HSWuJc98Igt5YVzi22so63Ok6mHiXby6J.png"},{"name":"أزرق","image":"https://cdn.salla.sa/Zpqzp/4539eb3f-78fa-448a-b328-8662ace732cb-500x500-xmDeqZbYd41R5a0dpjqml6bfqp2rtnaa26XxuRkh.png"}]},{"id":2063304202,"model":"iPhone 15 Pro","image":"https://cdn.salla.sa/Zpqzp/f2fe50cc-fec7-4345-a59e-ddb75ff075e1-120x120-MQ4ZfENOTb4QiJeusLECaVdB2qqlLDftCA7jDESi.png","available":false,"limit":0,"colors":[{"name":"أسود","image":"https://cdn.salla.sa/Zpqzp/d472b5a8-2230-4a84-a3d3-53cc23316c59-500x500-Om3GbkmfbFXJA6qEgppF0921NlFQmeyiOvMnSpVd.png"}]},{"id":365727250,"model":"iPhone 15 Pro Max","image":"https://cdn.salla.sa/Zpqzp/f2829f2e-f996-4812-8af3-e1b8362f0227-120x120-88ogA3ejl3SuzyZdYwb3yElB0q9Re8a5v4Lt0mzM.png","available":false,"limit":0,"colors":[{"name":"أسود","image":"https://cdn.salla.sa/Zpqzp/ebf4b193-bea8-45ac-9bdc-2b891fefb812-500x500-P6LM6jBrgXbeo3pLMnH3m5dGXgqVAEGWquTOlt2B.png"}]},{"id":788867359,"model":"iPhone 14 Pro Max","image":"https://cdn.salla.sa/Zpqzp/8bbc98a0-d66b-403c-89cd-81313d52b963-120x120-PBPc6kpk8NX0HOyFGJHjazwMaqAzwWmmusf5Pkyb.png","available":false,"limit":0,"colors":[{"name":"ذهبي","image":"https://cdn.salla.sa/Zpqzp/94a64f7b-8ec4-43b6-8422-8d94cb29946f-500x500-4ZTcPcasf6TvNrTWo58eUjCFDMEHpJpeid271aiZ.png"},{"name":"أبيض/فضي","image":"https://cdn.salla.sa/Zpqzp/88b457b9-72e9-4ee2-907b-7e71b078c6f9-500x500-Y7LLysp3wqXdHdBbKQNSCj5fRdkWFvnq8JMuGCmH.png"},{"name":"أسود","image":"https://cdn.salla.sa/Zpqzp/638b98f9-24a2-428b-acfa-8397f44dab26-500x500-nPHCTQfHYedK11hbxndtzE2qNGIhxZhX2xntH2kw.png"}]}]},
  {"title":"كفر ستيل Link","group":"covers","products":[{"id":1888150293,"model":"iPhone 17 Pro","image":"https://cdn.salla.sa/Zpqzp/c2bb4995-4cc9-42b7-a777-46c0c2de34ec-120x120-Sq6OyODdAaqBs4B9D9tAUHTrGeHof0AqBgRsBjwx.png","available":false,"limit":0,"colors":[{"name":"أسود","image":"https://cdn.salla.sa/Zpqzp/aa1d8a32-f73b-4ba8-86ae-1c786003496c-500x500-0i8RhL9LkIeJ05zVh6izA1z9rPgrH3degzcbO0yQ.png"},{"name":"أورانج","image":"https://cdn.salla.sa/Zpqzp/cec47f9e-b129-4624-b8f6-2f825fbe3f10-500x500-W7cjpLoUZDq2qJR8jWvU1YS7DpF2vwpGEeK5H2ZV.png"},{"name":"جملي","image":"https://cdn.salla.sa/Zpqzp/6cffe136-dc3f-4207-8c2a-46851f2441bb-500x500-WqiaurtDhUpL74M7prIto1JsDGGTEbi8Shmh2Hv7.png"},{"name":"رمادي","image":"https://cdn.salla.sa/Zpqzp/86434b7d-43d6-4f17-af65-503dac806b57-491.90476190476x500-9hFq8YyX9ozlRWZAFMRsQix265l9XYEw8XpmuG1b.png"}]},{"id":803760153,"model":"iPhone 17 Pro","image":"https://cdn.salla.sa/Zpqzp/e6d330b6-408c-4745-9947-3ff85ce818a7-120x120-VHv3a2xJMTW51LCc4WjIvHvOjavkZhgABxYB0LoE.png","available":false,"limit":0,"standaloneColor":true,"colors":[{"name":"ذهبي","available":false,"limit":0}]},{"id":473702679,"model":"iPhone 17 Pro Max","image":"https://cdn.salla.sa/Zpqzp/c3cdf00c-2665-425d-98cc-8fc657c35de7-120x120-zkWZ7cKb6JUHwddGcY3wYum3v8woGxrd86OsH90j.png","available":false,"limit":0,"colors":[{"name":"أسود","image":"https://cdn.salla.sa/Zpqzp/72ec09a2-ee3a-4fdc-9cd2-39800f543cec-500x500-drotK1AT2l1C4A7B3yMSfVoSZsokG3W2WpnDsxjo.png"},{"name":"أورانج","image":"https://cdn.salla.sa/Zpqzp/6e17eeec-e9bb-4051-9e1e-80cfee5633e0-500x500-Mh7tjcylqEn0iUQflG9aguEx1Yi4LSCkeXuok0A5.png"},{"name":"جملي","image":"https://cdn.salla.sa/Zpqzp/c6f321fe-4272-4e73-bfee-7f9aebca310d-500x500-L90dYqfZhLUfk557Z7fy9zQsVlIj1L5qLH6QpQTz.png"},{"name":"رمادي","image":"https://cdn.salla.sa/Zpqzp/77bf7f5c-b4f0-42a0-ba39-cb25d52df3f3-491.90476190476x500-U16nVra0QNgOVCh99ayzGhdHTefftYdfulOPR26d.png"}]},{"id":1018757751,"model":"iPhone 17 Pro Max","image":"https://cdn.salla.sa/Zpqzp/113e3e25-4df9-48e8-89ec-2c153af0ff58-120x120-iGDQ5AnhPbUo9l0cWakohFVXABmrA7N7ydM3fRNw.png","available":false,"limit":0,"standaloneColor":true,"colors":[{"name":"ذهبي","available":false,"limit":0}]},{"id":2028095512,"model":"iPhone 17 Air","image":"https://cdn.salla.sa/Zpqzp/7bd5fc2b-c18a-43b3-b2eb-a6708fcfb1c6-120x120-JIds9VEBj9Gn8LioyDizGtCYzLDQWguDlwcYLQj6.png","available":false,"limit":0,"colors":[{"name":"جملي","image":"https://cdn.salla.sa/Zpqzp/15667377-c8aa-4466-a8fd-becbd75d3ed2-500x500-40L4p4BauZj6xzbguQvxMxfQmRtyt3XscoqH25ji.png"},{"name":"رمادي","image":"https://cdn.salla.sa/Zpqzp/4d27e8e8-758d-41a1-8a86-35d3f7e0d97e-500x500-00oTdTP11Lr7NjmbLvMwzBXGoLllxQyL6pJ5FfT3.png"}]},{"id":1847148560,"model":"iPhone 18 Pro","image":"https://cdn.salla.sa/Zpqzp/f5020277-c173-41b9-9ba7-c7e8dffd0d74-120x120-Bsrh18c1XhSRJctv0JNx0ai8iUCq8O6ZnTHh54kB.png","available":false,"limit":0,"colors":[{"name":"أسود","image":"https://cdn.salla.sa/Zpqzp/75e2f1f6-364e-453f-a017-2a1826540398-500x500-s893CuzC6yXhCDY9PJM9RDKnI7L5OGaKJf2G3aQK.png"},{"name":"أورانج","image":"https://cdn.salla.sa/Zpqzp/971fe3b1-3f9e-47a0-8e46-31aa13f91e43-500x500-MWaqn7XhSOxfxkkBHrVsAwJIZBd649Y6s21mlK1Z.png"},{"name":"جملي","image":"https://cdn.salla.sa/Zpqzp/081d4477-88bb-4e11-a8fb-d78d533ec2c6-500x500-mx0VRobj1O8H1QOaf0ombRg3FNPN9TmxI7yq1lSk.png"},{"name":"رمادي","image":"https://cdn.salla.sa/Zpqzp/af8086ec-74aa-4829-9b9d-cdb7ab0836b4-491.90476190476x500-ndmGy6YLTDUo51Yp5As49CDQNfkVoJVaaO79LkcC.png"}]},{"id":2041935642,"model":"iPhone 18 Pro","image":"https://cdn.salla.sa/Zpqzp/7c909a60-7725-4013-88dd-5360c90d4012-120x120-jNelhgcbhvNuD8Ai8jDpirBJj7gxHXl2n2m0kYmJ.png","available":false,"limit":0,"standaloneColor":true,"colors":[{"name":"ذهبي","available":false,"limit":0}]},{"id":1987220763,"model":"iPhone 18 Pro Max","image":"https://cdn.salla.sa/Zpqzp/5da4ff75-725e-4e01-975f-8424ec9f1673-120x120-NfDx5kWmdhDtWmmTwWMRjAyYQ6D6cbLy2qaI620o.png","available":false,"limit":0,"colors":[{"name":"رمادي","image":"https://cdn.salla.sa/Zpqzp/437ca449-aed3-4be4-9208-19ce4e655b6c-491.90476190476x500-9q8ziSH5H9PSlHLAzGv31TJqu4cjjx77XOjo9Sd5.png"},{"name":"أسود","image":"https://cdn.salla.sa/Zpqzp/87e27f31-6dcb-4ffd-9208-10ed75178572-500x500-qPO7sq8gPUGDzWhRhBP581X40GaSkQWYK2g6rYjY.png"},{"name":"أورانج","image":"https://cdn.salla.sa/Zpqzp/441454cf-ec92-4a9f-9a8e-031a3cab2b53-500x500-xblEqWFNUYQMoMcACBKnqzjJeozUPVqilY7zfW9U.png"},{"name":"جملي","image":"https://cdn.salla.sa/Zpqzp/7005581a-3d5e-4958-b3d3-a3b63ba22949-500x500-Z6GvJzlyguYlYbOrJvoebbvvnYAtJId0SjEwCHxf.png"}]},{"id":243671408,"model":"iPhone 18 Pro Max","image":"https://cdn.salla.sa/Zpqzp/585c30a5-8b54-430f-8cc9-e28f0c407ac2-120x120-HEDqkrpzGZURzzxF1LHKAe0rvtXOGfNwZoxVhxVt.png","available":false,"limit":0,"standaloneColor":true,"colors":[{"name":"ذهبي","available":false,"limit":0}]}]},
  {"title":"كفر سبليندر شفاف MagSafe","group":"covers","products":[{"id":487022609,"model":"iPhone 16 Pro","image":"https://cdn.salla.sa/Zpqzp/62e68d3e-135b-4a08-ad00-fcb27e7f82ba-120x120-N7592EIRKTzUZgkoL08907HTkjQb2Wj2RCdMDzwX.png","available":false,"limit":0},{"id":1127891216,"model":"iPhone 16 Pro Max","image":"https://cdn.salla.sa/Zpqzp/50a5245c-3a98-4db9-80a0-e5550a840646-120x120-WssuIuOrAczu2Wp91EG5EbUw0L3Ss9mJxn89PKUv.png","available":false,"limit":0}]},
  {"title":"كفر ماجستي أسود","group":"covers","products":[{"id":1861062418,"model":"iPhone 16 Pro","image":"https://cdn.salla.sa/Zpqzp/63603982-b49b-473f-8105-43542b0cfb4b-120x118.2-iaB0fychMnLedHfkHRImuw6IbOx5Gbra3OlHG9yI.png","available":false,"limit":0},{"id":911805214,"model":"iPhone 16 Pro Max","image":"https://cdn.salla.sa/Zpqzp/1b5ed512-1570-4da5-9275-1e8344d4c6ce-120x118.08-LfajxwdES7hsI036duN15Osj8nGKMVU9bx8IO17n.png","available":false,"limit":0}]},
  {"title":"كفر سليم شفاف بأزرار","group":"covers","products":[{"id":177720604,"model":"iPhone 15 Pro","image":"https://cdn.salla.sa/Zpqzp/b038554e-dfb0-415b-b8cf-ceaa267f8889-120x120-MlGY1Wh4J1TBA1VU7o24cjHxAuGrTHviF7nNccL7.jpg","available":false,"limit":0},{"id":952806931,"model":"iPhone 15 Pro Max","image":"https://cdn.salla.sa/Zpqzp/4c2174dd-ac5a-4c8a-baf5-9a19138bde68-120x120-I3f8sAHuaBjX9KDDAOzMp3wC9DQSSd15kswMSItK.jpg","available":false,"limit":0},{"id":1685908509,"model":"iPhone 16","image":"https://cdn.salla.sa/Zpqzp/194bd09d-4b01-4ab5-9562-3d572aa23e90-120x120-74R7igwpHKl17K3mpGLef82kUTgElhvtVxfwxzwT.png","available":false,"limit":0},{"id":2501151,"model":"iPhone 16 Pro","image":"https://cdn.salla.sa/Zpqzp/5835bda3-e24d-4af3-89e5-b94c1c2c3b7d-120x120-9OcenGIjuzEUsSzxzrDILFsh9T4dmGg1wMScr2rg.png","available":false,"limit":0},{"id":1375947032,"model":"iPhone 16 Pro Max","image":"https://cdn.salla.sa/Zpqzp/7e4950e6-d43c-496f-8013-528187e1e124-120x120-5r53XMn6JmOXLjeWXOx5eWlFBFM1es3ZqaCssBfP.png","available":false,"limit":0}]},
  {"title":"باور بنك Link 10,000mAh","group":"chargers","products":[{"id":1798588537,"image":"https://cdn.salla.sa/Zpqzp/8ac2d4bf-8e9c-4f37-9047-70172e24c0cf-120x120-qRqsro7pPJNGkumNpYqUJQ9BkoeRsE6xGZEVHxYE.jpg","available":false,"limit":0}],"description":"شحن سريع بقدرة 20W"},
  {"title":"وصلة USB-C إلى Lightning","group":"cables","products":[{"id":68587123,"image":"https://cdn.salla.sa/Zpqzp/6b70bd79-9059-4f6b-b4b4-11aa58f74136-120x120-S1rEjH2tWYvkUf6j9f6HM97N2vnFGgOzHtreKHqI.png","available":false,"limit":0}],"description":"بطول 1.2 متر"},
  {"title":"وصلة USB-C إلى USB-C","group":"cables","products":[{"id":1374924156,"image":"https://cdn.salla.sa/Zpqzp/4b3302f5-cf3f-4cae-8d56-b5934d0d803e-120x120-SxWy8tqFGsnuMhfUD0YWJEofTnUA0VIYMINJuBpX.png","available":false,"limit":0}],"description":"بطول 1.2 متر"},
  {"title":"وصلة USB-C إلى USB-C","group":"cables","products":[{"id":709390194,"image":"https://cdn.salla.sa/Zpqzp/953aa97f-dfc2-421c-bc98-26934ad4b145-120x120-OcxDl64UK22LPlEYL9iAliKI1FuqpXFNkEC4gEOT.png","available":false,"limit":0}],"description":"بطول مترين"},
  {"title":"سماعة لنك السلكية","group":"audio","products":[{"id":2108025726,"image":"https://cdn.salla.sa/Zpqzp/99867539-c751-434e-9a29-d53b97a7b6a7-120x120-HAMeVbhGQyKEqWwzXS4nIUSx7jejm9K7rLwekUHV.jpg","available":false,"limit":0}],"description":"بمنفذ USB-C"},
  {"title":"حامل Link المغناطيسي YOYO 2IN1","group":"holders","products":[{"id":426715512,"image":"https://cdn.salla.sa/Zpqzp/21319657-da81-4159-979c-1e53eb4c938f-120x120-Z6ZIEkUkqqUafFfb6fbcyrn1BlTq4uqYrZhgS8Ut.png","available":false,"limit":0}],"description":"للجوال في السيارة"},
  {"title":"حامل Link المغناطيسي LUME","group":"holders","products":[{"id":1158764410,"image":"https://cdn.salla.sa/Zpqzp/bac0f535-cb37-4dd1-b487-80593b2f1b1e-120x120-q8gcDeimliVb2rdINGw1UuTzKZ7h55DPChc0uzp7.jpg","available":false,"limit":0}],"description":"للجوال في السيارة"}
];
const linkBundlePrice = 45;
const linkBundleMinimum = 3;
const linkBundleMaximum = 8;
const linkBundleShipping = 349;
const linkBundleTabs = [
  ['all', 'كل المنتجات'], ['covers', 'الكفرات'], ['frames', 'الإطارات'],
  ['screens', 'استيكرات الشاشة'], ['lenses', 'العدسات'], ['chargers', 'الشواحن والطاقة'],
  ['cables', 'الوصلات'], ['audio', 'السماعات'], ['holders', 'الحوامل'],
];
const linkBundleSwatches = {
  'أسود': '#282732', 'أبيض/فضي': '#f2f3f5', 'فضي': '#b5b8c2', 'تيتانيوم': '#a79b91',
  'أورانج': '#ee6a23', 'كحلي': '#273658', 'رمادي': '#6a6873', 'جملي': '#b47748',
  'ذهبي': '#d2a957', 'وردي': '#e4a6be', 'أزرق': '#5288c4', 'أخضر': '#7c9e86',
};

function linkBundleElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text) element.textContent = text;
  return element;
}

function linkBundlePaintSummary(list, chosen, loading) {
  if (!list) return;
  if (!chosen.length) {
    list.replaceChildren(linkBundleElement('p', 'selected-empty', 'القطع اللي تختارها تظهر هنا.'));
    return;
  }
  list.replaceChildren(...chosen.map(item => {
    const row = linkBundleElement('div', 'selected-entry lb-line');
    const image = linkBundleElement('img');
    image.src = item.image;
    image.alt = '';
    const name = linkBundleElement('span', 'selected-name');
    name.append(linkBundleElement('span', '', item.title));
    const detail = [item.model, item.color, item.quantity + ' ×'].filter(Boolean).join(' · ');
    name.append(linkBundleElement('small', 'lb-line-detail', detail));
    const remove = linkBundleElement('button', 'lb-line-remove', '−');
    remove.type = 'button';
    remove.dataset.remove = item.key;
    remove.disabled = loading;
    remove.setAttribute('aria-label', 'أنقص قطعة من ' + [item.title, item.model, item.color].filter(Boolean).join('، '));
    row.append(image, name, remove);
    return row;
  }));
}

function linkBundleReadPrice(value) {
  return Number(value && typeof value === 'object' ? value.amount : value);
}

function linkBundleProductApi() {
  const salla = window.salla;
  return typeof salla?.product?.getDetails === 'function' ? salla.product : salla?.api?.product;
}

function linkBundleColorKey(value) {
  return String(value).trim().replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي');
}

function linkBundleMakeVariants(family) {
  return family.products.flatMap(product => (product.colors || [null]).map(color => ({
    key: product.id + (color ? ':' + color.name : ''),
    id: product.id,
    title: family.title,
    model: product.model || '',
    color: color?.name || '',
    image: color?.image || product.image,
    max: product.max || linkBundleMaximum,
    limit: color ? color.limit || 0 : product.limit ?? linkBundleMaximum,
    available: color ? color.available === true : product.available === true,
    options: color?.options || null,
    requiresColor: Boolean(color && !product.standaloneColor),
    quantity: 0,
  })));
}

function linkBundleMountCatalog(root, grid, tabs, entries) {
  const cards = [];
  const catalogReads = new Map();
  let observer;
  const css = linkBundleElement('style', '', `
    #lnk-byob .lb-options{display:grid;gap:7px;margin-block:4px}
    #lnk-byob .lb-options[hidden],#lnk-byob .lb-color-list[hidden]{display:none!important}
    #lnk-byob .lb-model{display:grid;gap:4px;color:var(--muted,#625771);font-size:13px;font-weight:600!important}
    #lnk-byob .lb-model select{width:100%;min-height:42px;border:1px solid var(--line,#e5deee);border-radius:8px;background:#fff;padding:4px 8px;color:var(--ink,#21162e);font:inherit}
    #lnk-byob .lb-color-list{display:flex;flex-wrap:wrap;gap:5px}
    #lnk-byob .lb-color{display:inline-flex;align-items:center;gap:5px;min-height:38px;padding:3px 7px;border:1px solid var(--line,#e5deee);border-radius:7px;background:#fff;color:var(--ink,#21162e);font-size:12px;font-weight:600!important}
    #lnk-byob .lb-color[aria-pressed="true"]{border-color:var(--brand,#59259a);background:#f0e8f8;color:#451675;box-shadow:inset 0 0 0 1px var(--brand,#59259a)}
    #lnk-byob .lb-color i{width:14px;height:14px;border-radius:50%;border:1px solid #33234145;flex:none}
    #lnk-byob .lb-card-status{min-height:19px;color:var(--muted,#625771);font-size:12px}
    #lnk-byob .lb-card-status[data-available="true"]{color:var(--green,#155f3a)}
    #lnk-byob .lb-new-card .stepper button:disabled{opacity:.42}
    #lnk-byob .lb-new-card .info{min-height:0}
    #lnk-byob .lb-line.selected-entry{display:grid;grid-template-columns:37px minmax(0,1fr) 28px}
    #lnk-byob .lb-line-detail{display:block;color:var(--muted,#625771);font-size:11px;font-weight:400!important}
    #lnk-byob .lb-line-remove{height:30px;width:28px;padding:0;border:1px solid var(--line,#e5deee);border-radius:6px;background:#fff;color:var(--brand,#59259a)}
    #lnk-byob .lb-new-card .photo img{padding-top:12px}
    #lnk-byob .lb-details-toggle{display:none}
    @media(max-width:820px){
      #lnk-byob .lb-details-toggle:not([hidden]){display:inline-block;padding:0;border:0;background:transparent;color:var(--brand,#59259a);font-size:12px;text-decoration:underline}
      #lnk-byob .dockin > .selected-list.lb-mobile-open{display:grid;grid-column:1/-1;grid-row:4;max-height:32dvh;overflow:auto;margin:0;padding:5px 0}
    }
    @media(max-width:560px){
      #lnk-byob .lb-color{min-height:42px}
      #lnk-byob .lb-new-card .photo img{padding-top:7px}
    }
  `);
  root.prepend(css);
  const lead = root.querySelector('.hero .lead');
  if (lead) lead.textContent = 'اختر من حماية الجوال والشواحن والوصلات والحوامل، واجمع من 3 إلى 8 قطع بسعر موحّد.';
  const facts = root.querySelector('.offer-fact:last-child strong');
  if (facts) facts.textContent = 'شحن خزائن RedBox مجاني';

  tabs.replaceChildren(...linkBundleTabs.map(([key, label]) => {
    const button = linkBundleElement('button', '', label);
    button.type = 'button';
    button.dataset.tab = key;
    button.setAttribute('aria-selected', key === 'all' ? 'true' : 'false');
    button.setAttribute('aria-controls', grid.id);
    return button;
  }));

  function refresh(variants) {
    const id = variants[0].id;
    const api = linkBundleProductApi();
    if (catalogReads.has(id) || typeof api?.getDetails !== 'function') return;
    const request = Promise.resolve().then(() => api.getDetails(id, ['options'])).then(result => {
      const detail = result?.data?.product || result?.data;
      if (!detail || result.success === false || (detail.id && Number(detail.id) !== id)) return;
      const actualPrice = linkBundleReadPrice(detail.base_currency_price ?? detail.price);
      const available = actualPrice === linkBundlePrice && detail.is_out_of_stock !== true && detail.is_available !== false &&
        (detail.is_out_of_stock === false || detail.is_available === true ||
          (detail.status === 'sale' && (Number(detail.quantity) > 0 || detail.unlimited_quantity === true)));
      const options = Array.isArray(detail.options) ? detail.options : [];
      for (const entry of variants) {
        if (entry.requiresColor) {
          const option = options.length === 1 ? options[0] : null;
          const values = option?.details || option?.values || [];
          const value = values.find(candidate => linkBundleColorKey(candidate.name) === linkBundleColorKey(entry.color));
          if (option && value && Number(option.id) > 0 && Number(value.id) > 0) {
            entry.options = { [option.id]: value.id };
            const sku = detail.skus?.find?.(candidate => candidate.related_option_values?.some(id => Number(id) === Number(value.id)));
            entry.limit = sku && sku.unlimited_quantity !== true ? Math.max(0, Number(sku.stock_quantity) || 0) : linkBundleMaximum;
            const availability = Object.values(value.skus_availability || {});
            const stockConfirmed = value.is_out !== true && value.is_out_of_stock !== true &&
              (availability.length ? availability.some(Boolean) :
                value.is_out === false || value.is_out_of_stock === false || Boolean(sku));
            entry.available = available && stockConfirmed && entry.limit > 0 &&
              (!sku?.price || linkBundleReadPrice(sku.price) === linkBundlePrice);
          } else {
            entry.available = false;
          }
        } else {
          entry.limit = detail.unlimited_quantity === true || detail.quantity == null ?
            linkBundleMaximum : Math.max(0, Number(detail.quantity) || 0);
          entry.available = available && options.length === 0 && entry.limit > 0;
        }
      }
      for (const card of cards) if (card.variants.some(entry => entry.id === id)) card.draw();
    }).catch(() => {
      catalogReads.delete(id);
    });
    catalogReads.set(id, request);
  }

  for (const family of linkBundleCatalog) {
    const variants = linkBundleMakeVariants(family);
    variants.forEach(entry => entries.set(entry.key, entry));
    const card = linkBundleElement('article', 'card lb-new-card');
    card.dataset.group = family.group;
    const photo = linkBundleElement('div', 'photo');
    const image = linkBundleElement('img');
    image.loading = 'lazy';
    image.decoding = 'async';
    image.width = image.height = 500;
    photo.append(image);
    const info = linkBundleElement('div', 'info');
    const title = linkBundleElement('h3', '', family.title);
    info.append(title);
    if (family.description) info.append(linkBundleElement('p', 'meta', family.description));
    const models = [...new Set(variants.map(entry => entry.model))];
    const model = linkBundleElement('select');
    if (models.length > 1) {
      const label = linkBundleElement('label', 'lb-model', 'موديل الجوال');
      for (const name of models) {
        const option = linkBundleElement('option', '', name);
        option.value = name;
        model.append(option);
      }
      label.append(model);
      info.append(label);
    } else if (models[0]) {
      info.append(linkBundleElement('p', 'meta', models[0]));
    }
    const colorList = linkBundleElement('div', 'lb-color-list');
    colorList.setAttribute('role', 'group');
    colorList.setAttribute('aria-label', 'اللون');
    const options = linkBundleElement('div', 'lb-options');
    options.append(colorList);
    info.append(options);
    const money = linkBundleElement('div', 'money');
    money.append(linkBundleElement('strong', '', '45 ر.س'));
    const status = linkBundleElement('p', 'lb-card-status');
    status.setAttribute('aria-live', 'polite');
    const stepper = linkBundleElement('div', 'stepper');
    const plus = linkBundleElement('button', '', '+');
    const minus = linkBundleElement('button', '', '−');
    const quantity = linkBundleElement('output', '', '0');
    for (const [button, action] of [[plus, 'plus'], [minus, 'minus']]) {
      button.type = 'button';
      button.dataset.act = action;
      button.setAttribute('aria-label', (action === 'plus' ? 'زيادة كمية ' : 'تقليل كمية ') + family.title);
    }
    stepper.append(plus, quantity, minus);
    info.append(money, status, stepper);
    card.append(photo, info);

    let current;
    let loading = false;
    function paint() {
      const lineCount = variants.reduce((total, entry) => total + entry.quantity, 0);
      card.classList.toggle('is-selected', lineCount > 0);
      if (!current) return;
      quantity.textContent = current.quantity;
      plus.disabled = loading || !current.available;
      minus.disabled = loading || current.quantity === 0;
      status.dataset.available = String(current.available);
      status.textContent = current.available ? '' : 'غير متاح حاليًا';
    }

    function show(entry) {
      current = entry;
      image.src = entry.image;
      image.alt = [entry.title, entry.model, entry.color].filter(Boolean).join(' – ');
      plus.dataset.id = minus.dataset.id = entry.key;
      colorList.querySelectorAll('button').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.key === entry.key)));
      paint();
    }

    function updateModel() {
      const choices = variants.filter(entry => entry.model === (models.length > 1 ? model.value : models[0]));
      options.hidden = !choices.some(entry => entry.color);
      colorList.replaceChildren(...choices.filter(entry => entry.color).map(entry => {
        const button = linkBundleElement('button', 'lb-color');
        button.type = 'button';
        button.dataset.key = entry.key;
        button.setAttribute('aria-pressed', 'false');
        const swatch = linkBundleElement('i');
        swatch.style.background = linkBundleSwatches[entry.color] || '#bbb';
        swatch.setAttribute('aria-hidden', 'true');
        button.append(swatch, document.createTextNode(entry.color));
        button.addEventListener('click', () => {
          show(entry);
          refresh(variants.filter(other => other.id === entry.id));
        });
        return button;
      }));
      show(choices.find(entry => entry.available) || choices[0]);
      return choices;
    }

    function checkCurrentModel() {
      const ids = new Set(variants.filter(entry => entry.model === current.model).map(entry => entry.id));
      for (const id of ids) refresh(variants.filter(entry => entry.id === id));
    }

    model.addEventListener('change', () => {
      updateModel();
      checkCurrentModel();
    });
    card.addEventListener('focusin', checkCurrentModel);
    cards.push({ card, variants, draw: paint, checkCurrentModel, setLoading: value => { loading = value; paint(); } });
    updateModel();
    grid.append(card);
  }

  if ('IntersectionObserver' in window) {
    observer = new IntersectionObserver(changes => {
      for (const { isIntersecting, target } of changes) {
        if (isIntersecting && typeof linkBundleProductApi()?.getDetails === 'function') {
          cards.find(card => card.card === target).checkCurrentModel();
          observer.unobserve(target);
        }
      }
    }, { rootMargin: '140px' });
    cards.forEach(({ card }) => observer.observe(card));
  }
  window.addEventListener('load', () => {
    cards.filter(({ card }) => !card.hidden && card.getBoundingClientRect().top < window.innerHeight + 140)
      .forEach(card => card.checkCurrentModel());
  }, { once: true });

  return loading => cards.forEach(card => card.setLoading(loading));
}

function __linkByobMount() {
  const root = document.getElementById('lnk-byob');
  if (!root || root.getAttribute('data-ready')) return false;
  const expanded = /\/page-1764311570\/?$/.test(window.location.pathname);
  const el = id => root.querySelector('#' + id);
  const grid = el('lb-products');
  const tabs = root.querySelector('.tabs');
  const checkout = el('lb-to-cart');
  const feedback = el('lb-feedback');
  if (!checkout || !feedback || !el('lb-count') || !el('lb-thumbs')) return false;

  const entries = new Map(linkBundleLegacy.map(entry => [String(entry.id), {
    ...entry, key: String(entry.id), available: true, quantity: 0,
  }]));
  root.setAttribute('data-ready', '1');
  const paintCatalog = expanded && grid && tabs ? linkBundleMountCatalog(root, grid, tabs, entries) : null;
  const summaryList = paintCatalog ? root.querySelector('.selected-list') : null;
  const basketHead = summaryList ? root.querySelector('.basket-head') : null;
  const summaryToggle = basketHead ? linkBundleElement('button', 'lb-details-toggle', 'تفاصيل البكج') : null;
  if (summaryToggle) {
    summaryList.id ||= 'lb-selected-list';
    summaryToggle.type = 'button';
    summaryToggle.setAttribute('aria-controls', summaryList.id);
    summaryToggle.setAttribute('aria-expanded', 'false');
    summaryToggle.addEventListener('click', () => {
      const open = summaryList.classList.toggle('lb-mobile-open');
      summaryToggle.setAttribute('aria-expanded', String(open));
      summaryToggle.textContent = open ? 'إخفاء التفاصيل' : 'تفاصيل البكج';
    });
    basketHead.append(summaryToggle);
  }
  let loading = false;

  const selected = () => [...entries.values()].filter(entry => entry.quantity > 0);
  const count = chosen => chosen.reduce((sum, entry) => sum + entry.quantity, 0);
  const setText = (id, value) => { const element = el(id); if (element) element.textContent = value; };
  const setBar = (id, percent) => { const element = el(id); if (element) element.style.width = Math.min(100, percent) + '%'; };

  function paint() {
    const chosen = selected();
    const pieces = count(chosen);
    const amount = pieces * linkBundlePrice;
    const remain = Math.max(0, linkBundleShipping - amount);
    setText('lb-count', pieces);
    setText('lb-count-top', 'بكجك: ' + pieces + ' من ' + linkBundleMaximum);
    setText('lb-total', amount);
    setBar('lb-count-bar', pieces / linkBundleMaximum * 100);
    setBar('lb-ship-bar', amount / linkBundleShipping * 100);
    setText('lb-shipping-msg', remain ? 'باقي ' + remain + ' ر.س للشحن المجاني' : 'تأهل البكج للشحن المجاني عبر خزائن RedBox');
    const note = pieces < linkBundleMinimum ? 'أضف ' + (linkBundleMinimum - pieces) + ' قطع لبدء البكج' :
      pieces < linkBundleMaximum ? 'أضف ' + (linkBundleMaximum - pieces) + ' قطع للوصول للشحن المجاني' : 'اكتمل بكجك';
    setText('lb-next', note);
    setText('lb-dock-next', note);
    checkout.disabled = loading || pieces < linkBundleMinimum || pieces > linkBundleMaximum;
    checkout.textContent = loading ? 'جاري إضافة المنتجات…' : 'أضف البكج للسلة';
    for (const legacy of linkBundleLegacy) {
      const item = entries.get(String(legacy.id));
      setText('lb-qty-' + item.id, item.quantity);
      root.querySelector('[data-product="' + item.id + '"]')?.classList.toggle('is-selected', item.quantity > 0);
    }
    el('lb-thumbs').replaceChildren(...chosen.map(entry => {
      const image = linkBundleElement('img');
      image.src = entry.image;
      image.alt = '';
      return image;
    }));
    if (paintCatalog) {
      linkBundlePaintSummary(summaryList, chosen, loading);
      if (summaryToggle) {
        summaryToggle.hidden = !chosen.length;
        if (!chosen.length) {
          summaryList.classList.remove('lb-mobile-open');
          summaryToggle.setAttribute('aria-expanded', 'false');
          summaryToggle.textContent = 'تفاصيل البكج';
        }
      }
      paintCatalog(loading);
    }
  }

  root.addEventListener('click', event => {
    const tab = event.target.closest('button[data-tab]');
    if (tab) {
      const group = tab.dataset.tab;
      root.querySelectorAll('button[data-tab]').forEach(button => button.setAttribute('aria-selected', String(button === tab)));
      root.querySelectorAll('.card[data-group]').forEach(card => { card.hidden = group !== 'all' && card.dataset.group !== group; });
      return;
    }
    const button = event.target.closest('button[data-act],button[data-remove]');
    if (!button || loading) return;
    const entry = entries.get(button.dataset.id || button.dataset.remove);
    if (!entry) return;
    if (button.dataset.act === 'plus') {
      const chosen = selected();
      if (!entry.available) return;
      if (count(chosen) >= linkBundleMaximum) {
        feedback.textContent = 'الحد الأقصى 8 قطع';
        return;
      }
      const productQuantity = count(chosen.filter(item => item.id === entry.id));
      if (productQuantity >= entry.max || entry.quantity >= (entry.limit ?? linkBundleMaximum)) {
        feedback.textContent = 'وصلت للحد الأعلى لهذا المنتج';
        return;
      }
      entry.quantity++;
    } else {
      entry.quantity = Math.max(0, entry.quantity - 1);
    }
    feedback.textContent = '';
    paint();
    if (button.dataset.remove && document.activeElement === document.body) {
      root.querySelectorAll('button[data-remove]').forEach(element => {
        if (element.dataset.remove === entry.key) element.focus();
      });
    }
  });

  checkout.addEventListener('click', async () => {
    const chosen = selected();
    const pieces = count(chosen);
    if (loading || pieces < linkBundleMinimum || pieces > linkBundleMaximum) return;
    const cart = window.salla?.cart;
    if (typeof cart?.addItem !== 'function') {
      feedback.textContent = 'تعذر الاتصال بسلة. حدّث الصفحة وحاول مرة ثانية.';
      return;
    }
    if (chosen.some(item => !item.available || (item.requiresColor && !item.options))) {
      feedback.textContent = 'أحد الاختيارات غير متاح حاليًا. عدّل بكجك وحاول مرة ثانية.';
      return;
    }
    loading = true;
    feedback.textContent = '';
    paint();
    try {
      for (const item of chosen) {
        const payload = { id: item.id, quantity: item.quantity };
        if (item.options) payload.options = item.options;
        const result = await cart.addItem(payload);
        if (result?.success === false) throw Error('Cart rejected an item');
        item.quantity = 0;
      }
      window.location.assign('https://linkstore-sa.com/cart');
    } catch {
      loading = false;
      paint();
      feedback.textContent = 'تعذرت إضافة كل القطع. راجع السلة قبل إعادة المحاولة.';
    }
  });
  paint();
  return true;
}

window.__linkByobMount = __linkByobMount;
const init = () => {
  try { return __linkByobMount() === true; }
  catch (error) { console.error('[Link BYOB] init failed', error); return false; }
};
if (init()) return;
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
const observer = new MutationObserver(() => { if (init()) observer.disconnect(); });
observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener('load', () => { if (init()) observer.disconnect(); }, { once: true });
})();
