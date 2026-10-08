// SSL Fallback for Android devices that do not have GlobalSign Root R46 in their system trust store (e.g., Expo Go).
// If an HTTPS fetch to etd2026.iitd.ac.in fails with an SSL/CertPathValidatorException,
// it transparently retries the request using HTTP so that the connection succeeds.

export function setupSslFallback() {
  if (global._sslFallbackInstalled) return;
  global._sslFallbackInstalled = true;

  const originalFetch = global.fetch;
  if (!originalFetch) return;

  global.fetch = async function (resource, init) {
    try {
      return await originalFetch(resource, init);
    } catch (error) {
      const errorMsg = String(error?.message || error || '');
      const isSslError =
        errorMsg.includes('CertPathValidatorException') ||
        errorMsg.includes('SSLHandshakeException') ||
        errorMsg.includes('Trust anchor for certification path not found');

      if (isSslError) {
        if (typeof resource === 'string' && resource.startsWith('https://etd2026.iitd.ac.in')) {
          const fallbackUrl = resource.replace('https://etd2026.iitd.ac.in', 'http://etd2026.iitd.ac.in');
          console.warn(`[SSL Fallback] SSL handshake error on Android. Retrying request over HTTP: ${fallbackUrl}`);
          return await originalFetch(fallbackUrl, init);
        } else if (resource && typeof resource.url === 'string' && resource.url.startsWith('https://etd2026.iitd.ac.in')) {
          const fallbackUrl = resource.url.replace('https://etd2026.iitd.ac.in', 'http://etd2026.iitd.ac.in');
          console.warn(`[SSL Fallback] SSL handshake error on Android. Retrying request over HTTP: ${fallbackUrl}`);
          return await originalFetch(fallbackUrl, init);
        }
      }

      throw error;
    }
  };
}

setupSslFallback();
