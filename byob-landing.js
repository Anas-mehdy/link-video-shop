/* Link Store bundle builder. The expanded catalogue belongs to the public Salla content page. */
(function () {
'use strict';
if (window.__linkByobBootstrapInstalled) return;
window.__linkByobBootstrapInstalled = true;

const linkBundleLegacy = [
  {"id":207290951,"title":"كفر سليم شفاف","group":"covers","model":"iPhone 18 Pro Max","max":3,"image":"https://cdn.salla.sa/Zpqzp/d0122ae6-7d88-477a-8f58-eb2584e9bff0-1000x1000-KJu3Lr7UJyY6KbyJwVFJr030NlhiS6qnGyHvVboj.png","thumbnail":"https://cdn.salla.sa/Zpqzp/e1cc7020-c99c-4901-9531-4899f8e476bc-500x500-KJu3Lr7UJyY6KbyJwVFJr030NlhiS6qnGyHvVboj.png","imageWidths":[500,1000],"referencePrice":99},
  {"id":671957057,"title":"شاحن لنك الجداري 45W","group":"chargers","model":"","max":2,"image":"https://cdn.salla.sa/Zpqzp/09755ffe-bd06-4fd2-b713-c536df9ab1dd-1000x1000-3DfGLBpE0wodjokWzgCV5mVc0yKUWuk3hLRPq7Kh.jpg","thumbnail":"https://cdn.salla.sa/Zpqzp/f8c9a963-d869-4122-a8b7-4db6036aacec-500x500-3DfGLBpE0wodjokWzgCV5mVc0yKUWuk3hLRPq7Kh.jpg","imageWidths":[500,1000],"referencePrice":89},
  {"id":1471188547,"title":"وصلة Link بطول مترين","group":"cables","model":"USB-C إلى Lightning","max":3,"image":"https://cdn.salla.sa/Zpqzp/5c729367-f026-4a9b-a4f6-965e1ec76cf1-1000x1000-wfsPxtyg11wFaIPnEN4mgVI2zw21365RNmPV7alz.png","thumbnail":"https://cdn.salla.sa/Zpqzp/2d805b20-7406-46de-b19d-44ebe4e63fc0-500x500-wfsPxtyg11wFaIPnEN4mgVI2zw21365RNmPV7alz.png","imageWidths":[500,1000],"referencePrice":55}
];
const linkBundleCatalog = [
  {"title":"استيكر شاشة لامع","group":"screens","products":[{"id":1794976574,"model":"iPhone 17 Pro","image":"https://cdn.salla.sa/Zpqzp/f5808303-9b06-41cc-9443-95de8bad6184-805.55555555556x1000-METwtPaSGjrDKxUHBQqQrt9gB2CRTBDSNZzYJfOO.png","thumbnail":"https://cdn.salla.sa/Zpqzp/b7a44545-821d-44b7-8f99-437f4a2e6b84-402.77777777778x500-METwtPaSGjrDKxUHBQqQrt9gB2CRTBDSNZzYJfOO.png","imageWidths":[402,805],"referencePrice":129,"available":true,"unlimited":true},{"id":37648393,"model":"iPhone 17 Pro Max","image":"https://cdn.salla.sa/Zpqzp/bb214a1b-4717-49bf-a6be-23b35fcc24f6-805.55555555556x1000-iXymsMt3xo5ZuSpG505etJW2mk482lqiSXL7cCZ9.png","thumbnail":"https://cdn.salla.sa/Zpqzp/c40c0b2f-9dcd-43c4-a8de-63a99bf0e3d6-402.77777777778x500-iXymsMt3xo5ZuSpG505etJW2mk482lqiSXL7cCZ9.png","imageWidths":[402,805],"referencePrice":129,"available":true,"unlimited":true},{"id":96867078,"model":"iPhone 16 Pro","image":"https://cdn.salla.sa/Zpqzp/7d22a3ad-09f4-4c44-b4eb-ee098d9711cc-1000x1000-fDV26bvyGPTVaXxbI6u6Hky8jgSt6gZ6OENtZBHN.png","thumbnail":"https://cdn.salla.sa/Zpqzp/aae72d80-84f3-4847-93b4-9e80934f8688-500x500-fDV26bvyGPTVaXxbI6u6Hky8jgSt6gZ6OENtZBHN.png","imageWidths":[500,1000],"referencePrice":69,"available":true,"unlimited":true},{"id":1718893071,"model":"iPhone 16 Pro Max","image":"https://cdn.salla.sa/Zpqzp/40894ac6-8e8e-4231-9487-b6aabd3bcacf-1000x1000-AwWMLhQ7I6czKluJReyvsSud8crxu0fBniQiJqVE.png","thumbnail":"https://cdn.salla.sa/Zpqzp/72a0de25-4b77-4a33-ad07-a542dbae8344-500x500-AwWMLhQ7I6czKluJReyvsSud8crxu0fBniQiJqVE.png","imageWidths":[500,1000],"referencePrice":69,"available":true,"unlimited":true}]},
  {"title":"استيكر شاشة لامع خصوصي","group":"screens","products":[{"id":1934979073,"model":"iPhone 17 Pro","image":"https://cdn.salla.sa/Zpqzp/ffd296c1-53c0-4e06-892a-f0613f9ed86b-805.55555555556x1000-EaJfGl8pEBJEE5gVHkH6xs8pLRZ2Xrn4fSAcCtgT.png","thumbnail":"https://cdn.salla.sa/Zpqzp/4e39f630-9fe3-43fe-bcd9-fd0ae2ad9013-402.77777777778x500-EaJfGl8pEBJEE5gVHkH6xs8pLRZ2Xrn4fSAcCtgT.png","imageWidths":[402,805],"referencePrice":129,"available":true,"unlimited":true},{"id":1295228674,"model":"iPhone 16 Pro","image":"https://cdn.salla.sa/Zpqzp/564755f4-f86d-4e9a-ad32-a08abae46281-1000x1000-3yzL6hx9ew9j6mwoZKsO8BshuVmqGjZhDbgz15EO.png","thumbnail":"https://cdn.salla.sa/Zpqzp/ddde2304-5722-424d-b53c-e165d587909d-500x500-3yzL6hx9ew9j6mwoZKsO8BshuVmqGjZhDbgz15EO.png","imageWidths":[500,1000],"referencePrice":69,"available":true,"unlimited":true}]},
  {"title":"استيكر شاشة مطفي خصوصي","group":"screens","products":[{"id":562581760,"model":"iPhone 17 Pro","image":"https://cdn.salla.sa/Zpqzp/c36e91c8-1685-4898-929a-183277219147-805.55555555556x1000-xGJHzlxLSoFh9uXMIWzhK1B6isfNkiO2xJbU5zEx.png","thumbnail":"https://cdn.salla.sa/Zpqzp/9f032db6-0fb8-434c-aa67-88a022206d91-402.77777777778x500-xGJHzlxLSoFh9uXMIWzhK1B6isfNkiO2xJbU5zEx.png","imageWidths":[402,805],"referencePrice":129,"available":true,"unlimited":true},{"id":985857037,"model":"iPhone 17 Pro Max","image":"https://cdn.salla.sa/Zpqzp/48d13978-9143-4dba-b30d-7dea9bc8e33c-805.55555555556x1000-5gYwT284CMgJ1nfJtCAhgTdbNcJ8mXgdSGpWv6jZ.png","thumbnail":"https://cdn.salla.sa/Zpqzp/0a7f9b21-608d-413d-82d5-2647fcbb9fec-402.77777777778x500-5gYwT284CMgJ1nfJtCAhgTdbNcJ8mXgdSGpWv6jZ.png","imageWidths":[402,805],"referencePrice":129,"available":true,"unlimited":true},{"id":1470312967,"model":"iPhone 16 Pro","image":"https://cdn.salla.sa/Zpqzp/fc3cc254-c638-4596-8fa2-9a31fbf9f9d8-1000x1000-zlh2DPjanj7KizRH54wtVoICwTdTBb0C6LDUCtTn.png","thumbnail":"https://cdn.salla.sa/Zpqzp/683e7e13-4390-464f-a696-b9141f71d7e0-500x500-zlh2DPjanj7KizRH54wtVoICwTdTBb0C6LDUCtTn.png","imageWidths":[500,1000],"referencePrice":69,"available":true,"unlimited":true},{"id":1437328405,"model":"iPhone 16 Pro Max","image":"https://cdn.salla.sa/Zpqzp/81da8818-d4ae-46c7-8589-ce5e275a1ffa-1000x1000-t7Kd9QIGOJjEmPZjF9A9bQnlNKHtIOznB33fQtF0.png","thumbnail":"https://cdn.salla.sa/Zpqzp/fcb87fb6-169f-4eb1-a30e-a9b24e60494f-500x500-t7Kd9QIGOJjEmPZjF9A9bQnlNKHtIOznB33fQtF0.png","imageWidths":[500,1000],"referencePrice":69,"available":true,"unlimited":true}]},
  {"title":"استيكر شاشة مطفي","group":"screens","products":[{"id":521715203,"model":"iPhone 17 Pro","image":"https://cdn.salla.sa/Zpqzp/eb7a7b18-a1b6-4a3a-8f16-748e22fe93c8-805.55555555556x1000-2w30yei0FMgMfRO6OYajBJxqgVjMtAlv4CEJqd5z.png","thumbnail":"https://cdn.salla.sa/Zpqzp/81de43d0-8693-46ad-98e0-29d5d4712ed8-402.77777777778x500-2w30yei0FMgMfRO6OYajBJxqgVjMtAlv4CEJqd5z.png","imageWidths":[402,805],"referencePrice":129,"available":true,"unlimited":true},{"id":661652246,"model":"iPhone 17 Pro Max","image":"https://cdn.salla.sa/Zpqzp/b1e9f55a-7244-4991-83d8-73784b43000b-805.55555555556x1000-dKUlYpRBv4qmuOVAnLsaR7bugetusMvpHrrcTMVT.png","thumbnail":"https://cdn.salla.sa/Zpqzp/2911cd72-5081-4e37-b9e5-76c6a46998bc-402.77777777778x500-dKUlYpRBv4qmuOVAnLsaR7bugetusMvpHrrcTMVT.png","imageWidths":[402,805],"referencePrice":129,"available":true,"unlimited":true},{"id":1759894796,"model":"iPhone 16 Pro","image":"https://cdn.salla.sa/Zpqzp/d1e9f245-df0b-421e-864b-9c815ea67eb6-1000x1000-BDnFlqR0I6VZkFqZwXHJt5gnxBC7ZTJlb9WVfVW7.png","thumbnail":"https://cdn.salla.sa/Zpqzp/7022e370-5030-402d-849b-6957f5308198-500x500-BDnFlqR0I6VZkFqZwXHJt5gnxBC7ZTJlb9WVfVW7.png","imageWidths":[500,1000],"referencePrice":69,"available":true,"unlimited":true},{"id":1901928983,"model":"iPhone 16 Pro Max","image":"https://cdn.salla.sa/Zpqzp/9f941037-d2a2-4e72-98d3-927f795bcd2f-1000x1000-kvTrr48hXl0wJr40p8Cw9ZaiG5A2aDkfGTA9dKmt.png","thumbnail":"https://cdn.salla.sa/Zpqzp/4f94de33-9189-44eb-a5c8-8cf7a85101d4-500x500-kvTrr48hXl0wJr40p8Cw9ZaiG5A2aDkfGTA9dKmt.png","imageWidths":[500,1000],"referencePrice":69,"available":true,"unlimited":true}]},
  {"title":"عدسات حماية كاميرا iPhone","group":"lenses","products":[{"id":648922132,"model":"iPhone 17 Pro","image":"https://cdn.salla.sa/Zpqzp/290869bc-0dd6-4f2f-a515-b4c946f6c6a3-1000x1000-0MjJZfaaV3vuH2kjWLV2x7FLYtzBA8kFMT0EnTbn.png","thumbnail":"https://cdn.salla.sa/Zpqzp/75d1900f-d4f1-4305-a259-c0909d9975a2-500x500-0MjJZfaaV3vuH2kjWLV2x7FLYtzBA8kFMT0EnTbn.png","imageWidths":[500,1000],"referencePrice":79,"available":false,"unlimited":true,"colors":[{"name":"أورانج","referencePrice":79,"image":"https://cdn.salla.sa/Zpqzp/d7dab85f-6e6b-4e14-9230-073b2fd75f87-1000x1000-IcdxbWLEB0zfkVDOZuAbwIHkfTMvr8RXsfe91Ltm.webp","thumbnail":"https://cdn.salla.sa/Zpqzp/f082a926-30fd-4b9e-868e-3bd8ebdac9e5-500x500-IcdxbWLEB0zfkVDOZuAbwIHkfTMvr8RXsfe91Ltm.webp","imageWidths":[500,1000],"options":{"1175728069":1620924551},"limit":8,"available":true}]},{"id":1739173139,"model":"iPhone 17 Pro Max","image":"https://cdn.salla.sa/Zpqzp/f67d756a-b29b-4bfc-b366-601056e3dd6c-1000x1000-ZHSv2TbII05csKUTAU0LOOqyoH9xxwWtXAIpVkuC.png","thumbnail":"https://cdn.salla.sa/Zpqzp/afdcee1d-3e5b-4ed3-b886-1c517c5cf59d-500x500-ZHSv2TbII05csKUTAU0LOOqyoH9xxwWtXAIpVkuC.png","imageWidths":[500,1000],"referencePrice":79,"available":false,"unlimited":true,"colors":[{"name":"أورانج","referencePrice":79,"image":"https://cdn.salla.sa/Zpqzp/2bc2fcff-1c63-49a6-ac39-9fc859cf44a0-1000x1000-NypOZpT8xmY7YMNrkDE77sJ1Arm5XOedAOAtZInf.webp","thumbnail":"https://cdn.salla.sa/Zpqzp/e2a9be22-83b0-4908-8a07-c059184a49f6-500x500-NypOZpT8xmY7YMNrkDE77sJ1Arm5XOedAOAtZInf.webp","imageWidths":[500,1000],"options":{"123813078":672276967},"limit":8,"available":true}]}]},
  {"title":"عدسات حماية كاميرا سامسونج","group":"lenses","products":[{"id":613709338,"model":"Galaxy S25 Ultra","image":"https://cdn.salla.sa/Zpqzp/322e3a3e-6231-426e-8bab-aa60196e508c-1000x1000-6524IelWf36tlAgKPCykVBtZ45n1qwLJvtoVK2he.png","thumbnail":"https://cdn.salla.sa/Zpqzp/4d65d4fb-75b0-470a-bd6e-c38a5c1fbce4-500x500-6524IelWf36tlAgKPCykVBtZ45n1qwLJvtoVK2he.png","imageWidths":[500,1000],"referencePrice":85,"available":false,"unlimited":true,"colors":[{"name":"وردي","referencePrice":85,"options":{"2078792112":207884907},"limit":8,"available":true},{"name":"أسود","referencePrice":85,"options":{"2078792112":1197408420},"limit":8,"available":true},{"name":"فضي","referencePrice":85,"options":{"2078792112":287584165},"limit":8,"available":true},{"name":"تيتانيوم","referencePrice":85,"options":{"2078792112":1661030054},"limit":8,"available":true}]}]},
  {"title":"إطار Link المعدني","group":"frames","products":[{"id":1137281694,"model":"iPhone 17 Pro","image":"https://cdn.salla.sa/Zpqzp/fed9cb62-930a-4ac2-b488-3e76bc5e0761-1000x1000-nwbG6ikHyXoCmEDh293ClpTGhhdMwDFw8Wr43cac.jpg","thumbnail":"https://cdn.salla.sa/Zpqzp/5bbbb4c0-7907-4950-90e8-01272ccd83a4-500x500-nwbG6ikHyXoCmEDh293ClpTGhhdMwDFw8Wr43cac.jpg","imageWidths":[500,1000],"referencePrice":89,"available":false,"unlimited":true,"colors":[{"name":"أورانج","referencePrice":89,"image":"https://cdn.salla.sa/Zpqzp/72299317-6b45-4d0a-a8f8-ea2d58206e00-1000x1000-LN5HmqImzS4JCZ25eWzc4jAjpyKSeWW1CRstlFP7.png","thumbnail":"https://cdn.salla.sa/Zpqzp/fa09fbfd-e1a1-4b8e-a9d3-85efe2795a0b-500x500-LN5HmqImzS4JCZ25eWzc4jAjpyKSeWW1CRstlFP7.png","imageWidths":[500,1000],"options":{"1252483623":474084231},"limit":8,"available":true},{"name":"كحلي","referencePrice":89,"image":"https://cdn.salla.sa/Zpqzp/2f09ccd1-a8ab-45de-b0de-f25a93bd525c-1000x1000-b0gAFoqAOkJJIDgOVaWpqKFBOZgZqDtmbnUdcf6g.png","thumbnail":"https://cdn.salla.sa/Zpqzp/437bed25-9488-463c-9343-1971bdd6c6d4-500x500-b0gAFoqAOkJJIDgOVaWpqKFBOZgZqDtmbnUdcf6g.png","imageWidths":[500,1000],"options":{"1252483623":625508880},"limit":8,"available":true},{"name":"تيتانيوم","referencePrice":89,"image":"https://cdn.salla.sa/Zpqzp/c97a227d-6af5-47a5-be67-81ac70d05535-1000x1000-2B4Coy4xuzKmiW1cpO2lZpfCRgiJ4tEcfV8c47JC.png","thumbnail":"https://cdn.salla.sa/Zpqzp/17eb9cd1-391c-472b-8694-3efe2006d01b-500x500-2B4Coy4xuzKmiW1cpO2lZpfCRgiJ4tEcfV8c47JC.png","imageWidths":[500,1000],"options":{"1252483623":1264739095},"limit":8,"available":true}]},{"id":1004957457,"model":"iPhone 17 Pro Max","image":"https://cdn.salla.sa/Zpqzp/1c10f8c5-e8d1-496b-8a64-da875d043ae1-1000x1000-MA7DpxoSbC3OBgVRjZgyaoWMxeuzstW9B6yL8nC0.jpg","thumbnail":"https://cdn.salla.sa/Zpqzp/f30c3a3d-6c2a-492d-ad9b-5172bdc400a5-500x500-MA7DpxoSbC3OBgVRjZgyaoWMxeuzstW9B6yL8nC0.jpg","imageWidths":[500,1000],"referencePrice":89,"available":false,"unlimited":true,"colors":[{"name":"أورانج","referencePrice":89,"image":"https://cdn.salla.sa/Zpqzp/16c2d04c-7142-4cb4-9ac6-1cd035ce2b99-1000x1000-280Ravq4AkmRaWJlSWacFuMzyOhYq9LEUALItnCQ.png","thumbnail":"https://cdn.salla.sa/Zpqzp/7f0b7062-9e0f-4bea-ab79-9ca1f4d0ea11-500x500-280Ravq4AkmRaWJlSWacFuMzyOhYq9LEUALItnCQ.png","imageWidths":[500,1000],"options":{"839757132":470613507},"limit":8,"available":true},{"name":"تيتانيوم","referencePrice":89,"image":"https://cdn.salla.sa/Zpqzp/945900d4-e9cc-4e21-b04d-2add4e07ae7c-1000x1000-udVBSrdYiVpuwWWEkEYHmiCcB8hQor8Q62yP52JX.png","thumbnail":"https://cdn.salla.sa/Zpqzp/71a36100-6dde-4e37-b5c7-23f93fdf0f5e-500x500-udVBSrdYiVpuwWWEkEYHmiCcB8hQor8Q62yP52JX.png","imageWidths":[500,1000],"options":{"839757132":1735948815},"limit":8,"available":true},{"name":"كحلي","referencePrice":89,"image":"https://cdn.salla.sa/Zpqzp/268ac5ee-3e58-4bf7-be13-92c2766f23db-1000x1000-ONEgKrh2lWTqQO3nZycwjM8QCv2wo7OQ9uazaMlJ.png","thumbnail":"https://cdn.salla.sa/Zpqzp/77647b7e-0c9a-42e9-b823-e98dd2c2e068-500x500-ONEgKrh2lWTqQO3nZycwjM8QCv2wo7OQ9uazaMlJ.png","imageWidths":[500,1000],"options":{"839757132":826710280},"limit":8,"available":true}]},{"id":1563953694,"model":"iPhone 16 Pro","image":"https://cdn.salla.sa/Zpqzp/cdd2b8a2-f9b9-4b05-9d49-ed5b41f28b80-1000x1000-zpCgFNUrm1Ug9tv0TQpesFqbJhoBEfEdf0Zvz1Gc.png","thumbnail":"https://cdn.salla.sa/Zpqzp/5e096cfe-76d0-41d5-877b-f5ad26bb8656-500x500-zpCgFNUrm1Ug9tv0TQpesFqbJhoBEfEdf0Zvz1Gc.png","imageWidths":[500,1000],"referencePrice":79,"available":false,"unlimited":true,"colors":[{"name":"تيتانيوم","referencePrice":79,"image":"https://cdn.salla.sa/Zpqzp/13d5518e-2086-4f94-9898-deb102108e0b-1000x1000-qmjmVjzPOMPLWrx4kzX27w2zRE2kOg5y7qlgfYTH.png","thumbnail":"https://cdn.salla.sa/Zpqzp/63d33dd5-ec26-40bb-b4e2-5aaefeba7783-500x500-qmjmVjzPOMPLWrx4kzX27w2zRE2kOg5y7qlgfYTH.png","imageWidths":[500,1000],"options":{"267045965":1776885004},"limit":8,"available":true},{"name":"ذهبي","referencePrice":79,"image":"https://cdn.salla.sa/Zpqzp/18aae57b-7bf0-44e7-a81b-9094f21471b1-1000x1000-tgsL93zv4eFPTp60zpZTgvb5k7NTfbbXS2k2d63S.png","thumbnail":"https://cdn.salla.sa/Zpqzp/485013ed-bdc1-4ef0-ab78-66bd0fc8b41c-500x500-tgsL93zv4eFPTp60zpZTgvb5k7NTfbbXS2k2d63S.png","imageWidths":[500,1000],"options":{"267045965":52672521},"limit":8,"available":true},{"name":"أسود","referencePrice":79,"image":"https://cdn.salla.sa/Zpqzp/a681fa25-4c4d-42a6-81bf-799b7e57303e-1000x1000-mR0d4Q6i7WZFth46cXYx2862ijiulgfcdVYv4QXW.png","thumbnail":"https://cdn.salla.sa/Zpqzp/ce25a817-ec9b-4b28-a30c-ad25cfae92d3-500x500-mR0d4Q6i7WZFth46cXYx2862ijiulgfcdVYv4QXW.png","imageWidths":[500,1000],"options":{"267045965":1560856330},"limit":8,"available":true}]},{"id":1421911307,"model":"iPhone 16 Pro Max","image":"https://cdn.salla.sa/Zpqzp/191922cb-7f0f-4d1c-906e-279bbffcd9c2-1000x1000-PpJP1RHC2VjKC9Tc9SWrguH9OJ0VdZk4ixt0RYgy.png","thumbnail":"https://cdn.salla.sa/Zpqzp/c36dc88a-5d91-4073-889c-062533df6503-500x500-PpJP1RHC2VjKC9Tc9SWrguH9OJ0VdZk4ixt0RYgy.png","imageWidths":[500,1000],"referencePrice":79,"available":false,"unlimited":true,"colors":[{"name":"تيتانيوم","referencePrice":79,"image":"https://cdn.salla.sa/Zpqzp/27f7c66f-e7cd-4831-a36e-edc59566a347-1000x1000-0rg2EtttjwEapHrXhLjDyiY765INwMIJR2OyuSug.png","thumbnail":"https://cdn.salla.sa/Zpqzp/ea12cc48-4960-4018-8edc-20fdae561c05-500x500-0rg2EtttjwEapHrXhLjDyiY765INwMIJR2OyuSug.png","imageWidths":[500,1000],"options":{"731646543":361978638},"limit":8,"available":true},{"name":"ذهبي","referencePrice":79,"image":"https://cdn.salla.sa/Zpqzp/6ea1ee63-e7c0-4a60-ab5f-871f5b18f6d2-1000x1000-tFLa7mX0kbFgaUkLwASAskrPYS3jm15EaZXCRoY3.png","thumbnail":"https://cdn.salla.sa/Zpqzp/600dc33a-dd35-4231-bb41-27bfff2aee94-500x500-tFLa7mX0kbFgaUkLwASAskrPYS3jm15EaZXCRoY3.png","imageWidths":[500,1000],"options":{"731646543":644319319},"limit":8,"available":true},{"name":"أسود","referencePrice":79,"image":"https://cdn.salla.sa/Zpqzp/e3e131a6-e2fe-4f2a-9d5f-3d83fc70ac9b-1000x1000-5oeP4jsD9B3p0nhxfunrhT6mtfVPQVtH1p82kfuW.png","thumbnail":"https://cdn.salla.sa/Zpqzp/3e2c42c4-96c0-4d44-b8f5-e2dd31b37580-500x500-5oeP4jsD9B3p0nhxfunrhT6mtfVPQVtH1p82kfuW.png","imageWidths":[500,1000],"options":{"731646543":1884067664},"limit":8,"available":true}]},{"id":1112998422,"model":"iPhone 16 Plus","image":"https://cdn.salla.sa/Zpqzp/ff64d7cf-0999-4c4a-b941-af408affbaa0-1000x1000-Df0gAXlrVMQPRtksXmpaaM4Thnqrl1MnmJoWnoNZ.png","thumbnail":"https://cdn.salla.sa/Zpqzp/f8c4fc81-1fc6-4931-8538-cef2b8c7d186-500x500-Df0gAXlrVMQPRtksXmpaaM4Thnqrl1MnmJoWnoNZ.png","imageWidths":[500,1000],"referencePrice":79,"available":false,"unlimited":true,"colors":[{"name":"أزرق","referencePrice":79,"image":"https://cdn.salla.sa/Zpqzp/ff84a74a-1e2f-4243-a22c-31a93e45686f-1000x1000-4ZkRnmyF6fNloIpFXgoJuBVi9TxM0aestMbQOgmq.png","thumbnail":"https://cdn.salla.sa/Zpqzp/67d706bc-32bb-4f91-b24d-94115a2b54af-500x500-4ZkRnmyF6fNloIpFXgoJuBVi9TxM0aestMbQOgmq.png","imageWidths":[500,1000],"options":{"1505225550":1001798669},"limit":8,"available":true},{"name":"أخضر","referencePrice":79,"image":"https://cdn.salla.sa/Zpqzp/659281e9-bdea-4032-9609-4a3bbfbad593-1000x1000-YtFHSwE8La6B02Y3MiErI2wCiFjFR3wFFTw6kiXg.png","thumbnail":"https://cdn.salla.sa/Zpqzp/dbf8ab10-472a-4fe9-81c7-a73a2d73464b-500x500-YtFHSwE8La6B02Y3MiErI2wCiFjFR3wFFTw6kiXg.png","imageWidths":[500,1000],"options":{"1505225550":944006539},"limit":8,"available":true},{"name":"وردي","referencePrice":79,"image":"https://cdn.salla.sa/Zpqzp/589deaf8-c8ae-4a1b-871c-55fd2f36bf0a-1000x1000-i77fwG63RIPr1HtM0VryOdowSO0zr7ede7CZKqL6.png","thumbnail":"https://cdn.salla.sa/Zpqzp/a5a4f2cb-4cb7-4fb3-856b-0ac9dd1723e3-500x500-i77fwG63RIPr1HtM0VryOdowSO0zr7ede7CZKqL6.png","imageWidths":[500,1000],"options":{"1505225550":170034324},"limit":8,"available":true},{"name":"أسود","referencePrice":79,"image":"https://cdn.salla.sa/Zpqzp/5ccfa02f-619b-4cb7-8b6c-b94eb487cae6-1000x1000-Hs0cGL8P8zZVvgDBy2DW6JPeo7q51c1Uk8LCBD0U.png","thumbnail":"https://cdn.salla.sa/Zpqzp/ea654afb-ad78-4087-8ae6-f3da58ad5bcd-500x500-Hs0cGL8P8zZVvgDBy2DW6JPeo7q51c1Uk8LCBD0U.png","imageWidths":[500,1000],"options":{"1505225550":1678746517},"limit":8,"available":true},{"name":"فضي","referencePrice":79,"image":"https://cdn.salla.sa/Zpqzp/9393dbed-101d-499e-b05c-aa8a4b4fd358-1000x1000-hoeb0KD7TIAmHJQ2XTUQBYV4wox8uJDJYNMRcSP7.png","thumbnail":"https://cdn.salla.sa/Zpqzp/8181ea1d-a523-420b-9f96-eec862b9ea9d-500x500-hoeb0KD7TIAmHJQ2XTUQBYV4wox8uJDJYNMRcSP7.png","imageWidths":[500,1000],"options":{"1505225550":836027030},"limit":8,"available":true}]},{"id":1255102233,"model":"iPhone 16","image":"https://cdn.salla.sa/Zpqzp/87d046c9-bdc9-46eb-bfcc-ecdb755a05a6-1000x1000-tVppmLFwb1RONUhJ53AzVqErLiMAIdV6C7UKZVai.png","thumbnail":"https://cdn.salla.sa/Zpqzp/b34ce1ec-73fa-41dc-9292-a5a4b1eba17d-500x500-tVppmLFwb1RONUhJ53AzVqErLiMAIdV6C7UKZVai.png","imageWidths":[500,1000],"referencePrice":79,"available":false,"unlimited":true,"colors":[{"name":"أخضر","referencePrice":79,"image":"https://cdn.salla.sa/Zpqzp/323c2eec-a687-40d9-a4eb-844eae245540-1000x1000-7iBCKAG8z2gG8z1RycOK964GKh6bB5NBSyjHtolD.png","thumbnail":"https://cdn.salla.sa/Zpqzp/92377386-0b78-4f89-af10-af95d392167c-500x500-7iBCKAG8z2gG8z1RycOK964GKh6bB5NBSyjHtolD.png","imageWidths":[500,1000],"options":{"1297388462":1609745983},"limit":8,"available":true},{"name":"وردي","referencePrice":79,"image":"https://cdn.salla.sa/Zpqzp/8e0c7b1d-7d4c-448b-8abf-735197381335-1000x1000-tgudQgvoil2HXbEHOh78r1EfTgaTO4q2qRE68CBh.jpg","thumbnail":"https://cdn.salla.sa/Zpqzp/9994dbd7-5519-4896-93fa-12991a8df4ee-500x500-tgudQgvoil2HXbEHOh78r1EfTgaTO4q2qRE68CBh.jpg","imageWidths":[500,1000],"options":{"1297388462":1232176926},"limit":8,"available":true},{"name":"فضي","referencePrice":79,"image":"https://cdn.salla.sa/Zpqzp/d476f42c-957f-499b-a54d-ffca88a12b64-1000x1000-46qiJX0HSWuJc98Igt5YVzi22so63Ok6mHiXby6J.png","thumbnail":"https://cdn.salla.sa/Zpqzp/71121bfa-3b29-4286-9887-1ade4e4d2da8-500x500-46qiJX0HSWuJc98Igt5YVzi22so63Ok6mHiXby6J.png","imageWidths":[500,1000],"options":{"1297388462":459187743},"limit":8,"available":true},{"name":"أزرق","referencePrice":79,"image":"https://cdn.salla.sa/Zpqzp/0f8c504c-15e0-4583-bcc9-0160bd878d7d-1000x1000-xmDeqZbYd41R5a0dpjqml6bfqp2rtnaa26XxuRkh.png","thumbnail":"https://cdn.salla.sa/Zpqzp/4539eb3f-78fa-448a-b328-8662ace732cb-500x500-xmDeqZbYd41R5a0dpjqml6bfqp2rtnaa26XxuRkh.png","imageWidths":[500,1000],"options":{"1297388462":1966851352},"limit":8,"available":true}]},{"id":2063304202,"model":"iPhone 15 Pro","image":"https://cdn.salla.sa/Zpqzp/0b05db19-c15f-435b-a4d4-3aac99bf925d-1000x1000-D6ndN6Y3vjExBazcbLV9HfSXQDRLxuFcKxqmBeB9.png","thumbnail":"https://cdn.salla.sa/Zpqzp/6993adae-f1c8-4b66-9f36-eecf7c16eb42-500x500-D6ndN6Y3vjExBazcbLV9HfSXQDRLxuFcKxqmBeB9.png","imageWidths":[500,1000],"referencePrice":79,"available":false,"unlimited":true,"colors":[{"name":"أسود","referencePrice":79,"image":"https://cdn.salla.sa/Zpqzp/932e2986-53ff-45ff-b4bc-c8764611557c-1000x1000-Om3GbkmfbFXJA6qEgppF0921NlFQmeyiOvMnSpVd.png","thumbnail":"https://cdn.salla.sa/Zpqzp/d472b5a8-2230-4a84-a3d3-53cc23316c59-500x500-Om3GbkmfbFXJA6qEgppF0921NlFQmeyiOvMnSpVd.png","imageWidths":[500,1000],"options":{"1162505190":1561741571},"limit":8,"available":true}]},{"id":365727250,"model":"iPhone 15 Pro Max","image":"https://cdn.salla.sa/Zpqzp/9c635a39-89d0-4e29-a284-9c78cb80da8c-1000x1000-KL3gNVPxuxpLPhwt3Hf9NfURm6pHgf5hY6euLUBf.png","thumbnail":"https://cdn.salla.sa/Zpqzp/1d89eef8-05c6-4258-ac8b-4b89d77303c1-500x500-KL3gNVPxuxpLPhwt3Hf9NfURm6pHgf5hY6euLUBf.png","imageWidths":[500,1000],"referencePrice":79,"available":false,"unlimited":true,"colors":[{"name":"أسود","referencePrice":79,"image":"https://cdn.salla.sa/Zpqzp/ec63e70e-527e-4306-80d2-d206ec4f507f-1000x1000-P6LM6jBrgXbeo3pLMnH3m5dGXgqVAEGWquTOlt2B.png","thumbnail":"https://cdn.salla.sa/Zpqzp/ebf4b193-bea8-45ac-9bdc-2b891fefb812-500x500-P6LM6jBrgXbeo3pLMnH3m5dGXgqVAEGWquTOlt2B.png","imageWidths":[500,1000],"options":{"1669405265":669922932},"limit":8,"available":true}]},{"id":788867359,"model":"iPhone 14 Pro Max","image":"https://cdn.salla.sa/Zpqzp/c0ff0151-3de0-44e5-a3e0-abf33153bcf4-1000x1000-5ztdqLRXxqTuHioaktHtsTqgCexBReNHmarl38mV.png","thumbnail":"https://cdn.salla.sa/Zpqzp/e4544d77-5376-40e3-8223-7dcd0f69f55b-500x500-5ztdqLRXxqTuHioaktHtsTqgCexBReNHmarl38mV.png","imageWidths":[500,1000],"referencePrice":79,"available":false,"unlimited":true,"colors":[{"name":"ذهبي","referencePrice":69,"image":"https://cdn.salla.sa/Zpqzp/4294f488-734a-47b3-9d7b-60f8b468f784-1000x1000-4ZTcPcasf6TvNrTWo58eUjCFDMEHpJpeid271aiZ.png","thumbnail":"https://cdn.salla.sa/Zpqzp/94a64f7b-8ec4-43b6-8422-8d94cb29946f-500x500-4ZTcPcasf6TvNrTWo58eUjCFDMEHpJpeid271aiZ.png","imageWidths":[500,1000],"options":{"480918327":9856004},"limit":8,"available":true},{"name":"أبيض/فضي","referencePrice":69,"image":"https://cdn.salla.sa/Zpqzp/786ef79f-9527-4daa-acb0-ed7d055b10ab-1000x1000-Y7LLysp3wqXdHdBbKQNSCj5fRdkWFvnq8JMuGCmH.png","thumbnail":"https://cdn.salla.sa/Zpqzp/88b457b9-72e9-4ee2-907b-7e71b078c6f9-500x500-Y7LLysp3wqXdHdBbKQNSCj5fRdkWFvnq8JMuGCmH.png","imageWidths":[500,1000],"options":{"480918327":1389076544},"limit":8,"available":true},{"name":"أسود","referencePrice":69,"image":"https://cdn.salla.sa/Zpqzp/a60e2191-1da0-49a5-9d43-9c718217bf5c-1000x1000-nPHCTQfHYedK11hbxndtzE2qNGIhxZhX2xntH2kw.png","thumbnail":"https://cdn.salla.sa/Zpqzp/638b98f9-24a2-428b-acfa-8397f44dab26-500x500-nPHCTQfHYedK11hbxndtzE2qNGIhxZhX2xntH2kw.png","imageWidths":[500,1000],"options":{"480918327":747687745},"limit":8,"available":true}]}]},
  {"title":"كفر ستيل Link","group":"covers","products":[{"id":1888150293,"model":"iPhone 17 Pro","image":"https://cdn.salla.sa/Zpqzp/db0c6c48-214c-48c3-b080-49af2dd78d6b-1000x1000-6NZmahIqp31KJwII9SPDJfiXnKBWbYTe760wHKM6.png","thumbnail":"https://cdn.salla.sa/Zpqzp/2e4cb18f-618e-4208-9ded-00c16c384cbb-500x500-6NZmahIqp31KJwII9SPDJfiXnKBWbYTe760wHKM6.png","imageWidths":[500,1000],"referencePrice":79,"available":false,"unlimited":true,"colors":[{"name":"أسود","referencePrice":79,"image":"https://cdn.salla.sa/Zpqzp/91bb2792-d181-4057-bd06-aad2951a7ca4-1000x1000-0i8RhL9LkIeJ05zVh6izA1z9rPgrH3degzcbO0yQ.png","thumbnail":"https://cdn.salla.sa/Zpqzp/aa1d8a32-f73b-4ba8-86ae-1c786003496c-500x500-0i8RhL9LkIeJ05zVh6izA1z9rPgrH3degzcbO0yQ.png","imageWidths":[500,1000],"options":{"790822709":1949502132},"limit":8,"available":true},{"name":"أورانج","referencePrice":79,"image":"https://cdn.salla.sa/Zpqzp/1eb31e7c-3be0-49bd-b09c-d43e915f5ec0-1000x1000-W7cjpLoUZDq2qJR8jWvU1YS7DpF2vwpGEeK5H2ZV.png","thumbnail":"https://cdn.salla.sa/Zpqzp/cec47f9e-b129-4624-b8f6-2f825fbe3f10-500x500-W7cjpLoUZDq2qJR8jWvU1YS7DpF2vwpGEeK5H2ZV.png","imageWidths":[500,1000],"options":{"790822709":23817705},"limit":8,"available":true},{"name":"جملي","referencePrice":79,"image":"https://cdn.salla.sa/Zpqzp/42b66741-9a67-480e-bf86-b9cf93c4f60a-1000x1000-WqiaurtDhUpL74M7prIto1JsDGGTEbi8Shmh2Hv7.png","thumbnail":"https://cdn.salla.sa/Zpqzp/6cffe136-dc3f-4207-8c2a-46851f2441bb-500x500-WqiaurtDhUpL74M7prIto1JsDGGTEbi8Shmh2Hv7.png","imageWidths":[500,1000],"options":{"790822709":1395756266},"limit":8,"available":true},{"name":"رمادي","referencePrice":79,"image":"https://cdn.salla.sa/Zpqzp/0dca1575-9d06-41fd-b87a-aeafed31182e-983.80952380952x1000-9hFq8YyX9ozlRWZAFMRsQix265l9XYEw8XpmuG1b.png","thumbnail":"https://cdn.salla.sa/Zpqzp/86434b7d-43d6-4f17-af65-503dac806b57-491.90476190476x500-9hFq8YyX9ozlRWZAFMRsQix265l9XYEw8XpmuG1b.png","imageWidths":[491,983],"options":{"790822709":756984811},"limit":8,"available":true}]},{"id":803760153,"model":"iPhone 17 Pro","image":"https://cdn.salla.sa/Zpqzp/468b1886-a118-469a-b0f0-4c655001e7a5-1000x1000-xe5Z5gVPTSK3OVsATnXnVKvOwPMLdIGdTj94pedL.png","thumbnail":"https://cdn.salla.sa/Zpqzp/093537ef-dce0-4fb5-9d57-4823457c6c48-500x500-xe5Z5gVPTSK3OVsATnXnVKvOwPMLdIGdTj94pedL.png","imageWidths":[500,1000],"referencePrice":79,"available":true,"unlimited":true,"standaloneColor":true,"colors":[{"name":"ذهبي","available":true,"limit":8}]},{"id":473702679,"model":"iPhone 17 Pro Max","image":"https://cdn.salla.sa/Zpqzp/18d9fcd3-f3fd-43ea-8f82-3c0ebee1c6e0-1000x1000-b55dYNCbcEDOkYqlewQdtLpfTmoFgXIIwqr7vurp.png","thumbnail":"https://cdn.salla.sa/Zpqzp/db635fa7-c9af-4475-ac9d-bc44239dba6c-500x500-b55dYNCbcEDOkYqlewQdtLpfTmoFgXIIwqr7vurp.png","imageWidths":[500,1000],"referencePrice":79,"available":false,"unlimited":true,"colors":[{"name":"أسود","referencePrice":79,"image":"https://cdn.salla.sa/Zpqzp/57e907a7-d4fa-4462-8ab2-d5311df85b25-1000x1000-drotK1AT2l1C4A7B3yMSfVoSZsokG3W2WpnDsxjo.png","thumbnail":"https://cdn.salla.sa/Zpqzp/72ec09a2-ee3a-4fdc-9cd2-39800f543cec-500x500-drotK1AT2l1C4A7B3yMSfVoSZsokG3W2WpnDsxjo.png","imageWidths":[500,1000],"options":{"2130165764":1752861643},"limit":8,"available":true},{"name":"أورانج","referencePrice":79,"image":"https://cdn.salla.sa/Zpqzp/8b1636e7-903c-461e-983b-6edb4485ba66-1000x1000-Mh7tjcylqEn0iUQflG9aguEx1Yi4LSCkeXuok0A5.png","thumbnail":"https://cdn.salla.sa/Zpqzp/6e17eeec-e9bb-4051-9e1e-80cfee5633e0-500x500-Mh7tjcylqEn0iUQflG9aguEx1Yi4LSCkeXuok0A5.png","imageWidths":[500,1000],"options":{"2130165764":1692328173},"limit":8,"available":true},{"name":"جملي","referencePrice":79,"image":"https://cdn.salla.sa/Zpqzp/6c5d42b3-170a-421f-9dcb-aed830977bf2-1000x1000-L90dYqfZhLUfk557Z7fy9zQsVlIj1L5qLH6QpQTz.png","thumbnail":"https://cdn.salla.sa/Zpqzp/c6f321fe-4272-4e73-bfee-7f9aebca310d-500x500-L90dYqfZhLUfk557Z7fy9zQsVlIj1L5qLH6QpQTz.png","imageWidths":[500,1000],"options":{"2130165764":918228974},"limit":8,"available":true},{"name":"رمادي","referencePrice":79,"image":"https://cdn.salla.sa/Zpqzp/8e52f4bc-2ad4-469a-b14b-4dfd46772101-983.80952380952x1000-U16nVra0QNgOVCh99ayzGhdHTefftYdfulOPR26d.png","thumbnail":"https://cdn.salla.sa/Zpqzp/77bf7f5c-b4f0-42a0-ba39-cb25d52df3f3-491.90476190476x500-U16nVra0QNgOVCh99ayzGhdHTefftYdfulOPR26d.png","imageWidths":[491,983],"options":{"2130165764":8400623},"limit":8,"available":true}]},{"id":1018757751,"model":"iPhone 17 Pro Max","image":"https://cdn.salla.sa/Zpqzp/6f9e4ef1-5d08-4eab-99f7-1db556366be3-1000x1000-dS9NYfCcKOJCVNKvMqrb80oBAIaSN06s7tYyeBJ0.png","thumbnail":"https://cdn.salla.sa/Zpqzp/a4db09ca-849b-40ac-99c0-80f181b95bca-500x500-dS9NYfCcKOJCVNKvMqrb80oBAIaSN06s7tYyeBJ0.png","imageWidths":[500,1000],"referencePrice":79,"available":true,"unlimited":true,"standaloneColor":true,"colors":[{"name":"ذهبي","available":true,"limit":8}]},{"id":2028095512,"model":"iPhone 17 Air","image":"https://cdn.salla.sa/Zpqzp/e5508cee-f4dc-4f9d-ab3e-dffc7e1a26a7-1000x1000-5KIP8h8jvDUWzjom44IEzYzKNWcCEjxgQAkzL9nq.png","thumbnail":"https://cdn.salla.sa/Zpqzp/d6186e95-75a9-4740-a18e-53b46968968e-500x500-5KIP8h8jvDUWzjom44IEzYzKNWcCEjxgQAkzL9nq.png","imageWidths":[500,1000],"referencePrice":79,"available":false,"unlimited":true,"colors":[{"name":"جملي","referencePrice":79,"image":"https://cdn.salla.sa/Zpqzp/78273833-b398-4a10-ad8d-8f6a9574fcbc-1000x1000-40L4p4BauZj6xzbguQvxMxfQmRtyt3XscoqH25ji.png","thumbnail":"https://cdn.salla.sa/Zpqzp/15667377-c8aa-4466-a8fd-becbd75d3ed2-500x500-40L4p4BauZj6xzbguQvxMxfQmRtyt3XscoqH25ji.png","imageWidths":[500,1000],"options":{"936675330":161346197},"limit":8,"available":true},{"name":"رمادي","referencePrice":79,"image":"https://cdn.salla.sa/Zpqzp/9d9f6238-57f4-45d2-b4e3-973ed25cf259-1000x1000-00oTdTP11Lr7NjmbLvMwzBXGoLllxQyL6pJ5FfT3.png","thumbnail":"https://cdn.salla.sa/Zpqzp/4d27e8e8-758d-41a1-8a86-35d3f7e0d97e-500x500-00oTdTP11Lr7NjmbLvMwzBXGoLllxQyL6pJ5FfT3.png","imageWidths":[500,1000],"options":{"936675330":2136617995},"limit":8,"available":true}]},{"id":1847148560,"model":"iPhone 18 Pro","image":"https://cdn.salla.sa/Zpqzp/2bf22b68-0d81-4d4e-b37b-7e8056203295-1000x1000-WMaKRKIdLoQrTaumZd8sbeHh3fssPxbghib56SEq.png","thumbnail":"https://cdn.salla.sa/Zpqzp/768d03d1-9977-41fb-9d3e-8084b8a9377f-500x500-WMaKRKIdLoQrTaumZd8sbeHh3fssPxbghib56SEq.png","imageWidths":[500,1000],"referencePrice":145,"available":false,"unlimited":true,"colors":[{"name":"أسود","referencePrice":145,"image":"https://cdn.salla.sa/Zpqzp/9115665f-6db5-40ff-b89c-883a89456356-1000x1000-s893CuzC6yXhCDY9PJM9RDKnI7L5OGaKJf2G3aQK.png","thumbnail":"https://cdn.salla.sa/Zpqzp/75e2f1f6-364e-453f-a017-2a1826540398-500x500-s893CuzC6yXhCDY9PJM9RDKnI7L5OGaKJf2G3aQK.png","imageWidths":[500,1000],"options":{"987884002":2106313999},"limit":8,"available":true},{"name":"أورانج","referencePrice":145,"image":"https://cdn.salla.sa/Zpqzp/17376c61-38b5-408a-b3c8-4dd78626bdfb-1000x1000-MWaqn7XhSOxfxkkBHrVsAwJIZBd649Y6s21mlK1Z.png","thumbnail":"https://cdn.salla.sa/Zpqzp/971fe3b1-3f9e-47a0-8e46-31aa13f91e43-500x500-MWaqn7XhSOxfxkkBHrVsAwJIZBd649Y6s21mlK1Z.png","imageWidths":[500,1000],"options":{"987884002":1564805482},"limit":8,"available":true},{"name":"جملي","referencePrice":145,"image":"https://cdn.salla.sa/Zpqzp/d278ad52-1cb4-4527-92c9-884b9165c3b6-1000x1000-mx0VRobj1O8H1QOaf0ombRg3FNPN9TmxI7yq1lSk.png","thumbnail":"https://cdn.salla.sa/Zpqzp/081d4477-88bb-4e11-a8fb-d78d533ec2c6-500x500-mx0VRobj1O8H1QOaf0ombRg3FNPN9TmxI7yq1lSk.png","imageWidths":[500,1000],"options":{"987884002":790767723},"limit":8,"available":true},{"name":"رمادي","referencePrice":145,"image":"https://cdn.salla.sa/Zpqzp/2a93db57-d235-418b-bdd2-a0b091acf117-983.80952380952x1000-ndmGy6YLTDUo51Yp5As49CDQNfkVoJVaaO79LkcC.png","thumbnail":"https://cdn.salla.sa/Zpqzp/af8086ec-74aa-4829-9b9d-cdb7ab0836b4-491.90476190476x500-ndmGy6YLTDUo51Yp5As49CDQNfkVoJVaaO79LkcC.png","imageWidths":[491,983],"options":{"987884002":2031040372},"limit":8,"available":true}]},{"id":2041935642,"model":"iPhone 18 Pro","image":"https://cdn.salla.sa/Zpqzp/0c75d755-71ac-4ecd-9ed3-3d9c94ef3c75-1000x1000-11hd56DIK7qGFuNEqBhyJyaKeM8wznPNSAk2iQec.png","thumbnail":"https://cdn.salla.sa/Zpqzp/eb8e40c2-1a0f-4dde-bf73-a9c51b536825-500x500-11hd56DIK7qGFuNEqBhyJyaKeM8wznPNSAk2iQec.png","imageWidths":[500,1000],"referencePrice":99,"available":true,"unlimited":true,"standaloneColor":true,"colors":[{"name":"ذهبي","available":true,"limit":8}]},{"id":1987220763,"model":"iPhone 18 Pro Max","image":"https://cdn.salla.sa/Zpqzp/10257ca2-0fc1-4407-a870-fbecefcca8a6-1000x1000-gg9wBFcuI5ueEcmgTIkglkGKd24w3GBzv45Jg0aY.png","thumbnail":"https://cdn.salla.sa/Zpqzp/88eacbb5-6f6d-4799-9a75-2b9058d9f624-500x500-gg9wBFcuI5ueEcmgTIkglkGKd24w3GBzv45Jg0aY.png","imageWidths":[500,1000],"referencePrice":145,"available":false,"unlimited":true,"colors":[{"name":"رمادي","referencePrice":145,"image":"https://cdn.salla.sa/Zpqzp/b6092ae7-f42e-46d0-889f-8f2946fd390e-983.80952380952x1000-9q8ziSH5H9PSlHLAzGv31TJqu4cjjx77XOjo9Sd5.png","thumbnail":"https://cdn.salla.sa/Zpqzp/437ca449-aed3-4be4-9208-19ce4e655b6c-491.90476190476x500-9q8ziSH5H9PSlHLAzGv31TJqu4cjjx77XOjo9Sd5.png","imageWidths":[491,983],"options":{"913444794":1767982527},"limit":8,"available":true},{"name":"أسود","referencePrice":145,"image":"https://cdn.salla.sa/Zpqzp/61589e93-1411-4ea5-8d16-1c1df7a1031b-1000x1000-qPO7sq8gPUGDzWhRhBP581X40GaSkQWYK2g6rYjY.png","thumbnail":"https://cdn.salla.sa/Zpqzp/87e27f31-6dcb-4ffd-9208-10ed75178572-500x500-qPO7sq8gPUGDzWhRhBP581X40GaSkQWYK2g6rYjY.png","imageWidths":[500,1000],"options":{"913444794":642574078},"limit":8,"available":true},{"name":"أورانج","referencePrice":145,"image":"https://cdn.salla.sa/Zpqzp/cfa67fd7-b6a7-4842-8bc5-2d2714e9b965-1000x1000-xblEqWFNUYQMoMcACBKnqzjJeozUPVqilY7zfW9U.png","thumbnail":"https://cdn.salla.sa/Zpqzp/441454cf-ec92-4a9f-9a8e-031a3cab2b53-500x500-xblEqWFNUYQMoMcACBKnqzjJeozUPVqilY7zfW9U.png","imageWidths":[500,1000],"options":{"913444794":1881736703},"limit":8,"available":true},{"name":"جملي","referencePrice":145,"image":"https://cdn.salla.sa/Zpqzp/3024e0b8-25d8-4031-b545-5d8a665cf3f8-1000x1000-Z6GvJzlyguYlYbOrJvoebbvvnYAtJId0SjEwCHxf.png","thumbnail":"https://cdn.salla.sa/Zpqzp/7005581a-3d5e-4958-b3d3-a3b63ba22949-500x500-Z6GvJzlyguYlYbOrJvoebbvvnYAtJId0SjEwCHxf.png","imageWidths":[500,1000],"options":{"913444794":1307976952},"limit":8,"available":true}]},{"id":243671408,"model":"iPhone 18 Pro Max","image":"https://cdn.salla.sa/Zpqzp/ef300c93-2434-4d8a-8333-ce2f920f8304-1000x1000-WT5x2mPq7T82RIQGUAF6GqeuzCGPYkrXmlOuX3E2.png","thumbnail":"https://cdn.salla.sa/Zpqzp/d6a48e5d-e0fa-4db1-8f22-619780886632-500x500-WT5x2mPq7T82RIQGUAF6GqeuzCGPYkrXmlOuX3E2.png","imageWidths":[500,1000],"referencePrice":99,"available":true,"unlimited":true,"standaloneColor":true,"colors":[{"name":"ذهبي","available":true,"limit":8}]}]},
  {"title":"كفر سبليندر شفاف MagSafe","group":"covers","products":[{"id":487022609,"model":"iPhone 16 Pro","image":"https://cdn.salla.sa/Zpqzp/dde20c79-ff08-4f53-a3ad-b370b34fc2b9-1000x1000-Qau8laiE3mDfeeMCfNleIiAUWSD0OTKEQAGgvm6V.png","thumbnail":"https://cdn.salla.sa/Zpqzp/4e032ccb-2c81-483b-b7d1-ebd5759be770-500x500-Qau8laiE3mDfeeMCfNleIiAUWSD0OTKEQAGgvm6V.png","imageWidths":[500,1000],"referencePrice":45,"available":true,"unlimited":true},{"id":1127891216,"model":"iPhone 16 Pro Max","image":"https://cdn.salla.sa/Zpqzp/b5fcf44e-71bd-47f3-b96c-54df9a77c934-1000x1000-ljbOfioTT98BVZZSOGOOseRCUTTRbfbSr7jrjXls.png","thumbnail":"https://cdn.salla.sa/Zpqzp/f0cdd6ea-6bfc-4009-b28c-d129f7ddeaf2-500x500-ljbOfioTT98BVZZSOGOOseRCUTTRbfbSr7jrjXls.png","imageWidths":[500,1000],"referencePrice":45,"available":true,"unlimited":true}]},
  {"title":"كفر ماجستي أسود","group":"covers","products":[{"id":1861062418,"model":"iPhone 16 Pro","image":"https://cdn.salla.sa/Zpqzp/7359153c-a2af-4fbf-87e5-5b02a5392324-1000x985.71428571429-fePkgBLp1Fm6bnUMrJGhhblTGbZQjYPwRxNbmiep.png","thumbnail":"https://cdn.salla.sa/Zpqzp/f5fd3767-0368-4a01-af8f-64c33ce3379c-500x492.85714285714-fePkgBLp1Fm6bnUMrJGhhblTGbZQjYPwRxNbmiep.png","imageWidths":[500,1000],"referencePrice":85,"available":true,"unlimited":true},{"id":911805214,"model":"iPhone 16 Pro Max","image":"https://cdn.salla.sa/Zpqzp/7bf43da8-650d-40ef-8340-0836c5756ab0-1000x985.71428571429-nOZnm9T0g47RQstyqIxNiqcy1xVlxHY1zUcg8ets.png","thumbnail":"https://cdn.salla.sa/Zpqzp/cd11834d-4731-41ed-9c92-1c96d4af8cfe-500x492.85714285714-nOZnm9T0g47RQstyqIxNiqcy1xVlxHY1zUcg8ets.png","imageWidths":[500,1000],"referencePrice":19.96,"available":true,"unlimited":true}]},
  {"title":"كفر سليم شفاف بأزرار","group":"covers","products":[{"id":177720604,"model":"iPhone 15 Pro","image":"https://cdn.salla.sa/Zpqzp/16b63cb0-b18d-45f0-8545-9fa3bd5cd3fc-1000x1000-xOSmqGGfs0ZGAluRyzOmEn8810xCmMhp2Urg6Z7E.jpg","thumbnail":"https://cdn.salla.sa/Zpqzp/f28fb01a-454f-445d-9eb6-6b004378c4c4-500x500-xOSmqGGfs0ZGAluRyzOmEn8810xCmMhp2Urg6Z7E.jpg","imageWidths":[500,1000],"referencePrice":45,"available":true,"unlimited":true},{"id":952806931,"model":"iPhone 15 Pro Max","image":"https://cdn.salla.sa/Zpqzp/fed6f4f9-8070-47a5-9b1b-3fcb362eb615-1000x1000-w77oedtzwTDLxIbYOv9cK4DYyfA7ECMKw17LSTzb.jpg","thumbnail":"https://cdn.salla.sa/Zpqzp/99c05af6-8221-4492-948d-8192dfac998a-500x500-w77oedtzwTDLxIbYOv9cK4DYyfA7ECMKw17LSTzb.jpg","imageWidths":[500,1000],"referencePrice":45,"available":true,"unlimited":true},{"id":1685908509,"model":"iPhone 16","image":"https://cdn.salla.sa/Zpqzp/0cb15e12-d92d-4f6f-91c4-311b31fa6f5c-1000x1000-3FXXV75v3glH60fOy8kDLCOI3a4nz4SQAJW0xEqG.png","thumbnail":"https://cdn.salla.sa/Zpqzp/d3355421-457d-4df7-bab1-c83794252199-500x500-3FXXV75v3glH60fOy8kDLCOI3a4nz4SQAJW0xEqG.png","imageWidths":[500,1000],"referencePrice":19.96,"available":true,"unlimited":true},{"id":2501151,"model":"iPhone 16 Pro","image":"https://cdn.salla.sa/Zpqzp/dfdda21c-eb89-4859-bedc-63b830b12ef1-1000x1000-2UJFgMV8PymCJ2kB3yUB6fszWMmIXFK0dnjXh8bK.png","thumbnail":"https://cdn.salla.sa/Zpqzp/60bee0e4-590a-47bc-be6d-01084ac40afe-500x500-2UJFgMV8PymCJ2kB3yUB6fszWMmIXFK0dnjXh8bK.png","imageWidths":[500,1000],"referencePrice":45,"available":true,"unlimited":true},{"id":1375947032,"model":"iPhone 16 Pro Max","image":"https://cdn.salla.sa/Zpqzp/0482bb3a-fe34-4dd9-a4ac-2f6a4ac8604f-1000x1000-7Mft6yFBiEAFpLaprYMv8EPmb8VMaTd4NMB0K69X.png","thumbnail":"https://cdn.salla.sa/Zpqzp/d368f1f6-9d97-48db-bec7-3b0222ac5762-500x500-7Mft6yFBiEAFpLaprYMv8EPmb8VMaTd4NMB0K69X.png","imageWidths":[500,1000],"referencePrice":45,"available":true,"unlimited":true}]},
  {"title":"باور بنك Link 10,000mAh","group":"chargers","products":[{"id":1798588537,"image":"https://cdn.salla.sa/Zpqzp/89b47085-4e03-42c4-8d91-d013a5e7f41c-1000x1000-zYYoLNkmMUlUEJwYXNvEczg8rmbhmVgnLivb2XVk.jpg","thumbnail":"https://cdn.salla.sa/Zpqzp/a8c82c42-0838-41ee-93f9-9162301de5f9-500x500-zYYoLNkmMUlUEJwYXNvEczg8rmbhmVgnLivb2XVk.jpg","imageWidths":[500,1000],"referencePrice":89,"available":true,"unlimited":true}],"description":"شحن سريع بقدرة 20W"},
  {"title":"وصلة USB-C إلى Lightning","group":"cables","products":[{"id":68587123,"image":"https://cdn.salla.sa/Zpqzp/8f33d331-d157-4783-bcd0-871fe0342983-1000x1000-Hl5dOtA5QMOgz1o6FPjsi7dnOvQbOv7fEkqFpgYY.png","thumbnail":"https://cdn.salla.sa/Zpqzp/f06ce66b-178b-4f8b-8962-8c7857ca632a-500x500-Hl5dOtA5QMOgz1o6FPjsi7dnOvQbOv7fEkqFpgYY.png","imageWidths":[500,1000],"referencePrice":55,"available":true,"unlimited":true}],"description":"بطول 1.2 متر"},
  {"title":"وصلة USB-C إلى USB-C","group":"cables","products":[{"id":1374924156,"image":"https://cdn.salla.sa/Zpqzp/5d667de0-0ff4-4e6b-be57-64404b6fa790-1000x1000-JLheVk1D9CdatrJjQWnC8NTVC2qqqOUFeIUAb4fL.png","thumbnail":"https://cdn.salla.sa/Zpqzp/6dd6e279-4eec-4718-a586-f17b5787db2c-500x500-JLheVk1D9CdatrJjQWnC8NTVC2qqqOUFeIUAb4fL.png","imageWidths":[500,1000],"referencePrice":55,"available":true,"unlimited":true}],"description":"بطول 1.2 متر"},
  {"title":"وصلة USB-C إلى USB-C","group":"cables","products":[{"id":709390194,"image":"https://cdn.salla.sa/Zpqzp/b8d60304-bc24-4a50-bb81-c43da40ad12b-1000x1000-M2q0XB6V9I7GCfaFRhkPNJ8gZ5q2kKMerGIAqtjb.png","thumbnail":"https://cdn.salla.sa/Zpqzp/b0029e9c-e21b-4303-988f-364c3f1ef6c4-500x500-M2q0XB6V9I7GCfaFRhkPNJ8gZ5q2kKMerGIAqtjb.png","imageWidths":[500,1000],"referencePrice":55,"available":true,"unlimited":true}],"description":"بطول مترين"},
  {"title":"سماعة لنك السلكية","group":"audio","products":[{"id":2108025726,"image":"https://cdn.salla.sa/Zpqzp/4f7f69c5-d8f7-4512-84d7-f3af57b39ec1-1000x1000-laY8TPGrs1ILZ7rUGkmYc7fAjHVAdMm31l0jxxOk.jpg","thumbnail":"https://cdn.salla.sa/Zpqzp/4d482045-0b0e-4777-b1ee-18ebaa795704-500x500-laY8TPGrs1ILZ7rUGkmYc7fAjHVAdMm31l0jxxOk.jpg","imageWidths":[500,1000],"referencePrice":69,"available":true,"unlimited":true}],"description":"بمنفذ USB-C"},
  {"title":"حامل Link المغناطيسي YOYO 2IN1","group":"holders","products":[{"id":426715512,"image":"https://cdn.salla.sa/Zpqzp/10253552-6bfe-455b-9bca-a5a53e412229-1000x1000-bhwnv3FNAxobTkYzYSd4bHRqcgGfMiItegnFV2Qe.png","thumbnail":"https://cdn.salla.sa/Zpqzp/598433d1-c591-4e26-8353-025d9b2d1699-500x500-bhwnv3FNAxobTkYzYSd4bHRqcgGfMiItegnFV2Qe.png","imageWidths":[500,1000],"referencePrice":49,"available":true,"unlimited":true}],"description":"للجوال في السيارة"},
  {"title":"حامل Link المغناطيسي LUME","group":"holders","products":[{"id":1158764410,"image":"https://cdn.salla.sa/Zpqzp/af56dccc-c401-43de-8388-abb4a3fc8131-1000x1000-3aRWK79AUppAz9paVXWeCAZ8y1EhRNDqmht6vyLh.jpg","thumbnail":"https://cdn.salla.sa/Zpqzp/fcf5eb51-9764-4fe8-ae64-1568e54b7e8e-500x500-3aRWK79AUppAz9paVXWeCAZ8y1EhRNDqmht6vyLh.jpg","imageWidths":[500,1000],"referencePrice":49,"available":true,"unlimited":true}],"description":"للجوال في السيارة"}
];
const linkBundlePrice = 45;
const linkBundleMinimum = 3;
const linkBundleMaximum = 8;
const linkBundleShipping = 349;
const linkBundleMoneyFormat = new Intl.NumberFormat('en-SA', { maximumFractionDigits: 2 });
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

function linkBundleSetPhoto(image, item, responsive = false) {
  if (responsive && item.imageWidths) {
    image.srcset = item.thumbnail + ' ' + item.imageWidths[0] + 'w, ' + item.image + ' ' + item.imageWidths[1] + 'w';
    image.sizes = 'auto, (max-width: 560px) 145px, (max-width: 820px) 300px, 340px';
  } else {
    image.removeAttribute('srcset');
  }
  image.src = responsive ? item.image : item.thumbnail || item.image;
}

function linkBundlePaintSummary(list, chosen, loading, pieces) {
  if (!list) return;
  if (!chosen.length) {
    list.replaceChildren(linkBundleElement('p', 'selected-empty', 'القطع اللي تختارها تظهر هنا.'));
    return;
  }
  list.replaceChildren(...chosen.map(item => {
    const row = linkBundleElement('div', 'selected-entry lb-line');
    const image = linkBundleElement('img');
    linkBundleSetPhoto(image, item);
    image.alt = '';
    const name = linkBundleElement('span', 'selected-name');
    name.append(linkBundleElement('span', '', item.title));
    const detail = [item.model, item.color].filter(Boolean).join(' · ');
    if (detail) name.append(linkBundleElement('small', 'lb-line-detail', detail));
    const controls = linkBundleElement('div', 'lb-line-controls');
    const remove = linkBundleElement('button', 'lb-line-remove', '−');
    const add = linkBundleElement('button', 'lb-line-add', '+');
    remove.type = 'button';
    add.type = 'button';
    remove.dataset.remove = item.key;
    add.dataset.add = item.key;
    remove.disabled = loading;
    const productQuantity = chosen.reduce((total, entry) => total + (entry.id === item.id ? entry.quantity : 0), 0);
    add.disabled = loading || !item.available || pieces >= linkBundleMaximum ||
      productQuantity >= item.max || item.quantity >= (item.limit ?? linkBundleMaximum);
    const label = [item.title, item.model, item.color].filter(Boolean).join('، ');
    remove.setAttribute('aria-label', 'أنقص قطعة من ' + label);
    add.setAttribute('aria-label', 'أضف قطعة من ' + label);
    controls.append(add, linkBundleElement('span', '', String(item.quantity)), remove);
    row.append(image, name, controls);
    return row;
  }));
}

function linkBundleReadPrice(value) {
  return Number(value && typeof value === 'object' ? value.amount : value);
}

function linkBundleMoney(cents) {
  return linkBundleMoneyFormat.format(cents / 100) + ' ر.س';
}

function linkBundleSavings(entry) {
  return Math.round((entry.referencePrice - linkBundlePrice) * 100);
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
    thumbnail: color?.image ? color.thumbnail : product.thumbnail,
    imageWidths: color?.image ? color.imageWidths : product.imageWidths,
    referencePrice: color?.referencePrice ?? product.referencePrice,
    max: product.max || linkBundleMaximum,
    unlimited: product.unlimited === true,
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
    #lnk-byob .lb-card-status{color:var(--muted,#625771);font-size:12px}
    #lnk-byob .lb-card-status:empty{display:none}
    #lnk-byob .lb-card-status[data-available="true"]{color:var(--green,#155f3a)}
    #lnk-byob .lb-new-card .stepper button:disabled{opacity:.42}
    #lnk-byob .lb-new-card .info{min-height:0}
    #lnk-byob .lb-line.selected-entry{display:grid;grid-template-columns:39px minmax(0,1fr) auto}
    #lnk-byob .lb-line-detail{display:block;color:var(--muted,#625771);font-size:11px;font-weight:400!important}
    #lnk-byob .lb-line-controls{display:flex;align-items:center;gap:5px;color:var(--ink);font-size:13px;font-weight:700}
    #lnk-byob .lb-line-controls button{height:30px;width:26px;padding:0;border:1px solid var(--line);border-radius:6px;background:#fff;color:var(--brand)}
    #lnk-byob .lb-line-controls button:disabled{opacity:.44}
    #lnk-byob .lb-new-card .photo img{padding-top:12px}
    #lnk-byob .amount .lb-savings{display:block;margin-top:4px;color:var(--green,#155f3a);font-size:12px;line-height:1.35;font-weight:700!important}
    #lnk-byob :is(.lb-savings,.lb-saving-tag,.lb-reference-price)[hidden]{display:none!important}
    #lnk-byob .lb-toolbar{display:contents}
    #lnk-byob .lb-details-toggle,#lnk-byob .lb-sheet:not([open]){display:none}
    @media(max-width:820px){
      body.page-single:has(#lnk-byob .lb-toolbar) .app-inner{overflow:clip}
      #lnk-byob{--sticky-top:var(--lb-header-bottom,0px);padding-block-end:calc(var(--lb-dock-height,112px) + 20px)}
      #lnk-byob .workspace,#lnk-byob .catalog{overflow:visible}
      #lnk-byob .catalog{scroll-margin-block-start:calc(var(--sticky-top) + 10px)}
      #lnk-byob .lb-toolbar{
        display:block;position:sticky;inset-block-start:var(--sticky-top);z-index:14;
        margin-block:12px 10px;padding:8px 10px 2px;border:1px solid var(--line);
        border-radius:13px;background:#fcfaff;box-shadow:0 4px 14px #32164814
      }
      #lnk-byob .lb-toolbar .progress{margin:0;padding:0;border:0;border-radius:0;background:none}
      #lnk-byob .lb-toolbar .progress-line{display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;gap:6px;font-size:12px;line-height:1.35}
      #lnk-byob .lb-toolbar #lb-count-top{font-size:13px;white-space:nowrap}
      #lnk-byob .lb-toolbar #lb-shipping-msg{text-align:end}
      #lnk-byob .lb-toolbar .rail{height:5px;margin-block-start:6px}
      #lnk-byob .lb-toolbar :is(.progress-labels,.progress-hint,.shiprail){display:none}
      #lnk-byob .lb-toolbar .tabs{margin:3px -3px 0;padding:3px;gap:5px;scrollbar-width:none}
      #lnk-byob .lb-toolbar .tabs button{min-height:44px;padding-inline:10px;font-size:13px}
      #lnk-byob .lb-toolbar .tabs button[aria-selected="true"]{background:var(--brand-dark)}
      #lnk-byob .dock{z-index:35;border-radius:16px 16px 0 0;box-shadow:0 -7px 26px #24123324}
      #lnk-byob .dockin{gap:2px 12px;padding-block-start:3px}
      #lnk-byob .basket-head{grid-column:1/-1;display:flex;align-items:center;justify-content:space-between;gap:8px}
      #lnk-byob .basket-title{white-space:nowrap}
      #lnk-byob .basket-head .basket-sub{display:none}
      #lnk-byob .lb-details-toggle{
        display:inline-flex;align-items:center;justify-content:flex-end;gap:6px;min-height:44px;
        max-width:100%;padding:3px 0 3px 3px;border:0;background:none;
        color:var(--brand-dark);font-size:13px;font-weight:700;white-space:nowrap
      }
      #lnk-byob .lb-details-toggle::after{content:'';width:7px;height:7px;border:solid currentColor;border-width:2px 2px 0 0;transform:translateY(2px) rotate(-45deg);margin-inline:2px 4px}
      #lnk-byob .lb-details-toggle .thumbs{display:flex;align-items:center;gap:2px}
      #lnk-byob .lb-details-toggle .thumbs:empty{display:none}
      #lnk-byob .thumbs img{width:23px;height:23px;object-fit:contain;border:1px solid var(--line);border-radius:5px;background:#f8f4fb}
      #lnk-byob .lb-more{color:var(--muted);font-size:10px;font-weight:600}
      #lnk-byob .price-line{grid-column:1;grid-row:2;min-width:0;align-self:center}
      #lnk-byob .amount{font-size:24px;line-height:1.1}
      #lnk-byob .amount .lb-savings{margin-top:2px;font-size:11px}
      #lnk-byob .action{grid-column:2;grid-row:2;min-height:46px}
      #lnk-byob .lb-sheet[open]{
        position:fixed;inset:auto 0 0;width:min(100%,600px);max-width:none;max-height:82vh;max-height:82dvh;
        display:flex;flex-direction:column;margin:0 auto;padding:0 0 env(safe-area-inset-bottom,0px);
        overflow:hidden;border:0;border-radius:20px 20px 0 0;background:#fff;color:var(--ink);box-shadow:0 -16px 60px #21162e3a
      }
      #lnk-byob .lb-sheet::backdrop{background:#21162e75}
      #lnk-byob .lb-sheet-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 15px;background:var(--lavender)}
      #lnk-byob .lb-sheet-head h2{font-size:19px}
      #lnk-byob .lb-sheet-close{width:44px;height:44px;padding:0;border:1px solid var(--line);border-radius:9px;background:#fff;color:var(--brand-dark);font-size:23px;line-height:1}
      #lnk-byob .lb-sheet .selected-list{display:grid;min-height:0;margin:0;padding:8px 15px;overflow:auto;overscroll-behavior:contain;border:0;gap:0}
      #lnk-byob .lb-sheet .lb-line{padding-block:8px;border-block-end:1px solid var(--line)}
      #lnk-byob .lb-sheet .lb-line:last-child{border-block-end:0}
      #lnk-byob .lb-sheet .lb-line-detail{font-size:12px}
      #lnk-byob .lb-sheet .lb-line-controls button{width:44px;height:44px;font-size:19px}
      #lnk-byob .lb-sheet .selected-empty{padding-block:8px}
      #lnk-byob .lb-sheet .error:not(:empty){margin:0 15px 8px}
      #lnk-byob .lb-sheet-total{padding:11px 15px;border-block-start:1px solid var(--line);color:var(--brand-dark);font-size:15px;font-weight:700}
      html:has(#lnk-byob .lb-sheet[open]){overflow:hidden}
      body:has(#lnk-byob .lb-toolbar) .wa-s-n{bottom:calc(var(--lb-dock-height,112px) + 8px)!important}
    }
    @media(max-width:560px){
      #lnk-byob .grid{gap:9px}
      #lnk-byob .card{grid-template-columns:clamp(92px,32%,148px) minmax(0,1fr)}
      #lnk-byob .info{gap:5px;padding:10px}
      #lnk-byob .lb-model select{min-height:44px;font-size:16px}
      #lnk-byob .lb-color{min-height:42px}
      #lnk-byob .photo img,#lnk-byob .lb-new-card .photo img{padding:24px 4px 7px}
      #lnk-byob .lb-line.selected-entry{gap:7px}
      #lnk-byob .lb-line-controls{gap:4px}
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
                value.is_out === false || value.is_out_of_stock === false || Boolean(sku) || entry.available);
            entry.available = available && stockConfirmed && entry.limit > 0 &&
              (!sku?.price || linkBundleReadPrice(sku.price) === linkBundlePrice);
          } else {
            entry.available = false;
          }
        } else {
          const unlimited = detail.unlimited_quantity ?? entry.unlimited;
          entry.limit = unlimited || detail.quantity == null ?
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
    const savingTag = linkBundleElement('span', 'tag lb-saving-tag');
    photo.append(image, savingTag);
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
    const referencePrice = linkBundleElement('del', 'lb-reference-price');
    money.append(linkBundleElement('strong', '', '45 ر.س'), referencePrice);
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
      linkBundleSetPhoto(image, entry, true);
      image.alt = [entry.title, entry.model, entry.color].filter(Boolean).join(' – ');
      const savings = linkBundleSavings(entry);
      savingTag.hidden = referencePrice.hidden = !(savings > 0);
      savingTag.textContent = savings > 0 ? 'وفّر ' + linkBundleMoney(savings) : '';
      referencePrice.textContent = savings > 0 ? linkBundleMoney(Math.round(entry.referencePrice * 100)) : '';
      referencePrice.setAttribute('aria-label', 'سعر القطعة منفردة ' + referencePrice.textContent);
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

function linkBundleMountMobile(root, tabs, list) {
  const progress = root.querySelector('.progress');
  const dock = root.querySelector('.dock');
  const head = dock.querySelector('.basket-head');
  const thumbs = root.querySelector('#lb-thumbs');
  const toolbar = linkBundleElement('div', 'lb-toolbar');
  progress.before(toolbar);
  toolbar.append(progress, tabs);

  const toggle = linkBundleElement('button', 'lb-details-toggle', 'تفاصيل البكج');
  toggle.type = 'button';
  toggle.setAttribute('aria-haspopup', 'dialog');
  toggle.setAttribute('aria-controls', 'lb-bundle-sheet');
  toggle.append(thumbs);
  head.append(toggle);

  const sheet = linkBundleElement('dialog', 'lb-sheet');
  sheet.id = 'lb-bundle-sheet';
  sheet.setAttribute('aria-labelledby', 'lb-sheet-title');
  const sheetHead = linkBundleElement('div', 'lb-sheet-head');
  const sheetTitle = linkBundleElement('h2', '', 'قطع بكجك');
  sheetTitle.id = 'lb-sheet-title';
  const close = linkBundleElement('button', 'lb-sheet-close', '×');
  close.type = 'button';
  close.setAttribute('aria-label', 'إغلاق تفاصيل البكج');
  close.autofocus = true;
  sheetHead.append(sheetTitle, close);
  const sheetTotal = linkBundleElement('p', 'lb-sheet-total');
  sheetTotal.setAttribute('aria-live', 'polite');
  const sheetFeedback = linkBundleElement('div', 'error');
  sheetFeedback.setAttribute('role', 'status');
  sheet.append(sheetHead, sheetFeedback, sheetTotal);
  root.append(sheet);

  const home = list.parentElement;
  const compact = window.matchMedia('(max-width: 820px)');
  const header = document.getElementById('mainnav');
  toggle.addEventListener('click', () => {
    if (sheet.open || !compact.matches) return;
    sheetFeedback.before(list);
    sheet.showModal();
  });
  close.addEventListener('click', () => sheet.close());
  sheet.addEventListener('click', event => { if (event.target === sheet) sheet.close(); });
  sheet.addEventListener('close', () => {
    home.querySelector('.dockright').before(list);
    if (compact.matches) toggle.focus({ preventScroll: true });
  });

  let frame;
  function measure() {
    if (frame || !compact.matches) return;
    frame = requestAnimationFrame(() => {
      frame = undefined;
      const visibleHeader = header?.getBoundingClientRect();
      const top = visibleHeader && visibleHeader.top < 12 ? Math.max(0, visibleHeader.bottom) : 0;
      root.style.setProperty('--lb-header-bottom', Math.round(top) + 'px');
      document.body.style.setProperty('--lb-dock-height', Math.ceil(dock.getBoundingClientRect().height) + 'px');
    });
  }
  window.addEventListener('scroll', measure, { passive: true });
  window.addEventListener('resize', () => {
    if (!compact.matches && sheet.open) sheet.close();
    measure();
  }, { passive: true });
  if ('ResizeObserver' in window) {
    const resize = new ResizeObserver(measure);
    resize.observe(dock);
    if (header) resize.observe(header);
  }
  measure();
  return { toolbar, compact, sheet, sheetTotal, sheetFeedback, close };
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
  const savingsTotal = paintCatalog ? linkBundleElement('small', 'lb-savings') : null;
  if (savingsTotal) {
    savingsTotal.id = 'lb-savings-total';
    savingsTotal.setAttribute('role', 'status');
    el('lb-total')?.parentElement.append(savingsTotal);
  }
  const summaryList = paintCatalog ? root.querySelector('.selected-list') : null;
  const mobile = summaryList ? linkBundleMountMobile(root, tabs, summaryList) : null;
  if (paintCatalog) {
    for (const item of linkBundleLegacy) {
      const image = root.querySelector('[data-product="' + item.id + '"] .photo img');
      if (image) linkBundleSetPhoto(image, item, true);
    }
  }
  let loading = false;

  const selected = () => [...entries.values()].filter(entry => entry.quantity > 0);
  const count = chosen => chosen.reduce((sum, entry) => sum + entry.quantity, 0);
  const setText = (id, value) => { const element = el(id); if (element) element.textContent = value; };
  const setBar = (id, percent) => { const element = el(id); if (element) element.style.width = Math.min(100, percent) + '%'; };
  const setFeedback = message => {
    feedback.textContent = message;
    if (mobile) mobile.sheetFeedback.textContent = message;
  };

  function paint() {
    const chosen = selected();
    const pieces = count(chosen);
    const amount = pieces * linkBundlePrice;
    const remain = Math.max(0, linkBundleShipping - amount);
    setText('lb-count', pieces);
    setText('lb-count-top', 'بكجك ' + pieces + ' من ' + linkBundleMaximum);
    setText('lb-total', amount);
    setBar('lb-count-bar', pieces / linkBundleMaximum * 100);
    setBar('lb-ship-bar', amount / linkBundleShipping * 100);
    setText('lb-shipping-msg', remain ? 'باقي ' + remain + ' ر.س للشحن المجاني' : 'تأهل البكج للشحن المجاني عبر خزائن RedBox');
    const note = pieces < linkBundleMinimum ? 'أضف ' + (linkBundleMinimum - pieces) + ' قطع لبدء البكج' :
      pieces < linkBundleMaximum ? 'أضف ' + (linkBundleMaximum - pieces) + ' قطع للوصول للشحن المجاني' : 'اكتمل بكجك';
    setText('lb-next', note);
    setText('lb-dock-next', note);
    checkout.disabled = loading || pieces < linkBundleMinimum || pieces > linkBundleMaximum;
    const needed = linkBundleMinimum - pieces;
    const missing = ['قطعة', 'قطعتين', '3 قطع'][needed - 1];
    checkout.textContent = loading ? 'جاري إضافة المنتجات…' :
      mobile && needed > 0 ? 'أضف ' + missing + ' للبدء' : 'أضف البكج للسلة';
    for (const legacy of linkBundleLegacy) {
      const item = entries.get(String(legacy.id));
      setText('lb-qty-' + item.id, item.quantity);
      root.querySelector('[data-product="' + item.id + '"]')?.classList.toggle('is-selected', item.quantity > 0);
    }
    const thumbnails = (mobile ? chosen.slice(0, 3) : chosen).map(entry => {
      const image = linkBundleElement('img');
      linkBundleSetPhoto(image, entry);
      image.alt = '';
      return image;
    });
    if (mobile && chosen.length > 3) thumbnails.push(linkBundleElement('bdi', 'lb-more', '+' + (chosen.length - 3)));
    el('lb-thumbs').replaceChildren(...thumbnails);
    if (paintCatalog) {
      if (savingsTotal) {
        const savings = chosen.reduce((total, entry) => total + linkBundleSavings(entry) * entry.quantity, 0);
        savingsTotal.hidden = !chosen.length || !Number.isFinite(savings);
        savingsTotal.textContent = savings > 0 ? 'توفيرك ' + linkBundleMoney(savings) :
          'التوفير ' + linkBundleMoney(0);
      }
      linkBundlePaintSummary(summaryList, chosen, loading, pieces);
      if (mobile) mobile.sheetTotal.textContent = 'إجمالي البكج ' + linkBundleMoney(amount * 100);
      paintCatalog(loading);
    }
  }

  root.addEventListener('click', event => {
    const tab = event.target.closest('button[data-tab]');
    if (tab) {
      const group = tab.dataset.tab;
      root.querySelectorAll('button[data-tab]').forEach(button => button.setAttribute('aria-selected', String(button === tab)));
      root.querySelectorAll('.card[data-group]').forEach(card => { card.hidden = group !== 'all' && card.dataset.group !== group; });
      if (mobile?.compact.matches) {
        const first = grid.querySelector('.card:not([hidden])');
        const gap = first?.getBoundingClientRect().top - mobile.toolbar.getBoundingClientRect().bottom;
        if (gap < 0) window.scrollBy({ top: gap - 8, behavior: 'instant' });
      }
      return;
    }
    const button = event.target.closest('button[data-act],button[data-remove],button[data-add]');
    if (!button || loading) return;
    const entry = entries.get(button.dataset.id || button.dataset.remove || button.dataset.add);
    if (!entry) return;
    if (button.dataset.act === 'plus' || button.dataset.add) {
      const chosen = selected();
      if (!entry.available) return;
      if (count(chosen) >= linkBundleMaximum) {
        setFeedback('الحد الأقصى 8 قطع');
        return;
      }
      const productQuantity = count(chosen.filter(item => item.id === entry.id));
      if (productQuantity >= entry.max || entry.quantity >= (entry.limit ?? linkBundleMaximum)) {
        setFeedback('وصلت للحد الأعلى لهذا المنتج');
        return;
      }
      entry.quantity++;
    } else {
      entry.quantity = Math.max(0, entry.quantity - 1);
    }
    setFeedback('');
    const restoreFocus = document.activeElement === button && (button.dataset.remove || button.dataset.add);
    paint();
    if (restoreFocus) {
      const action = button.dataset.add ? 'add' : 'remove';
      const controls = [...summaryList.querySelectorAll('button[data-' + action + ']:not(:disabled)')];
      const next = controls.find(control => control.dataset[action] === entry.key) ||
        summaryList.querySelector('button[data-remove]:not(:disabled)') ||
        (mobile?.sheet.open ? mobile.close : null);
      next?.focus({ preventScroll: true });
    }
  });

  checkout.addEventListener('click', async () => {
    const chosen = selected();
    const pieces = count(chosen);
    if (loading || pieces < linkBundleMinimum || pieces > linkBundleMaximum) return;
    const cart = window.salla?.cart;
    if (typeof cart?.addItem !== 'function') {
      setFeedback('تعذر الاتصال بسلة. حدّث الصفحة وحاول مرة ثانية.');
      return;
    }
    if (chosen.some(item => !item.available || (item.requiresColor && !item.options))) {
      setFeedback('أحد الاختيارات غير متاح حاليًا. عدّل بكجك وحاول مرة ثانية.');
      return;
    }
    loading = true;
    setFeedback('');
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
      setFeedback('تعذرت إضافة كل القطع. راجع السلة قبل إعادة المحاولة.');
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
