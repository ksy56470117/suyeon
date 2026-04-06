/**
 * Templater user script: 마인드맵 내보내기
 * Templater에서 tp.user.mindmap_export("png") 형태로 호출
 */
async function mindmapExport(format) {
  const f = format || 'both';
  const file = app.workspace.getActiveFile();
  if (!file) return '활성 파일이 없습니다.';

  const vaultPath = app.vault.adapter.basePath;
  const filePath = `${vaultPath}/${file.path}`;
  const scriptsDir = `${vaultPath}/scripts`;
  const nodeCmd = `/Users/a1/.nvm/versions/node/v20.19.0/bin/node`;

  const { exec } = require('child_process');
  return new Promise((resolve, reject) => {
    exec(
      `"${nodeCmd}" "${scriptsDir}/mindmap-export.js" "${filePath}" "${f}"`,
      { timeout: 30000, cwd: scriptsDir },
      (error, stdout, stderr) => {
        if (error) {
          new Notice(`마인드맵 내보내기 실패: ${error.message}`, 5000);
          reject(error.message);
        } else {
          new Notice(`마인드맵 내보내기 완료!\n${stdout.trim()}`, 5000);
          resolve(stdout.trim());
        }
      }
    );
  });
}

module.exports = mindmapExport;
