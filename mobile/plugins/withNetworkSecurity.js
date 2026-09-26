const { withAndroidManifest, withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const withNetworkSecurity = (config) => {
  // 1. Inject attributes into AndroidManifest.xml
  config = withAndroidManifest(config, async (config) => {
    const mainApplication = config.modResults.manifest.application[0];
    mainApplication.$['android:networkSecurityConfig'] = '@xml/network_security_config';
    mainApplication.$['android:usesCleartextTraffic'] = 'true';
    return config;
  });

  // 2. Write network_security_config.xml and copy certificate to res/raw/
  config = withDangerousMod(config, [
    'android',
    async (config) => {
      const resDir = path.join(config.modRequest.platformProjectRoot, 'app', 'src', 'main', 'res');
      const xmlDir = path.join(resDir, 'xml');
      const rawDir = path.join(resDir, 'raw');

      fs.mkdirSync(xmlDir, { recursive: true });
      fs.mkdirSync(rawDir, { recursive: true });

      // Create network_security_config.xml
      const xmlContent = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <base-config cleartextTrafficPermitted="true">
        <trust-anchors>
            <certificates src="system" />
            <certificates src="user" />
            <certificates src="@raw/globalsign_root_r46" />
        </trust-anchors>
    </base-config>
    <domain-config cleartextTrafficPermitted="true">
        <domain includeSubdomains="true">iitd.ac.in</domain>
        <domain includeSubdomains="true">etd2026.iitd.ac.in</domain>
        <trust-anchors>
            <certificates src="system" />
            <certificates src="user" />
            <certificates src="@raw/globalsign_root_r46" />
        </trust-anchors>
    </domain-config>
</network-security-config>`;

      fs.writeFileSync(path.join(xmlDir, 'network_security_config.xml'), xmlContent);

      // Copy certificate to res/raw/globalsign_root_r46.crt
      const srcCert = path.join(config.modRequest.projectRoot, 'certs', 'globalsign_root_r46.crt');
      if (fs.existsSync(srcCert)) {
        fs.copyFileSync(srcCert, path.join(rawDir, 'globalsign_root_r46.crt'));
      }

      return config;
    },
  ]);

  return config;
};

module.exports = withNetworkSecurity;
