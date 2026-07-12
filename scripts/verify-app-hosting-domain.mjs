import { Resolver } from "node:dns/promises";
import https from "node:https";

const domain = process.env.MEDARIO_APP_DOMAIN || "app.medario.com.br";
const expectedA = process.env.MEDARIO_APP_A || "35.219.200.200";
const expectedTxt = process.env.MEDARIO_APP_TXT || "fah-claim=023-02-ecae48a6-00a5-4455-b246-82a1ff0caaa9";
const challengeHost = `_acme-challenge_w2lv6yenuls7hto7.${domain}`;
const expectedCname = "2c314b74-2596-4e27-b117-48fa7dfcd05a.0.authorize.certificatemanager.goog";

const resolver = new Resolver();
resolver.setServers(["8.8.8.8", "1.1.1.1"]);

async function resolve(name, method) {
  try {
    return await resolver[method](name);
  } catch (error) {
    return { error: error.code || error.message };
  }
}

function flattenTxt(records) {
  return Array.isArray(records) ? records.flatMap((record) => record).filter(Boolean) : [];
}

function checkExpected(values, expected) {
  return !values.error && values.includes(expected);
}

function checkHttps() {
  return new Promise((resolveResult) => {
    const request = https.get(`https://${domain}/`, { timeout: 10_000 }, (response) => {
      response.resume();
      resolveResult({ ok: true, status: response.statusCode });
    });
    request.on("error", (error) => resolveResult({ ok: false, error: error.code || error.message }));
    request.on("timeout", () => request.destroy(new Error("timeout")));
  });
}

const [addresses, txtRecords, cnameRecords, httpsResult] = await Promise.all([
  resolve(domain, "resolve4"),
  resolve(domain, "resolveTxt"),
  resolve(challengeHost, "resolveCname"),
  checkHttps(),
]);
const txt = flattenTxt(txtRecords);
const cname = cnameRecords.error ? [] : cnameRecords.map((value) => value.replace(/\.$/, ""));
const result = {
  domain,
  dns: {
    a: { expected: expectedA, actual: addresses, ok: checkExpected(addresses, expectedA) },
    txt: { expected: expectedTxt, actual: txt, ok: checkExpected(txt, expectedTxt) },
    cname: { host: challengeHost, expected: expectedCname, actual: cname, ok: checkExpected(cname, expectedCname) },
  },
  https: httpsResult,
};

console.log(JSON.stringify(result, null, 2));
if (!result.dns.a.ok || !result.dns.txt.ok || !result.dns.cname.ok || !result.https.ok) process.exitCode = 1;
