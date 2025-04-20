export function toggleLanguage() {
  const currentLang = document.documentElement.lang;
  const newLang = currentLang === 'en' ? 'zh' : (currentLang === 'zh' ? 'ja' : 'en');
  document.documentElement.lang = newLang;

  // 更新开始按钮图标
  const startButton = document.getElementById('startGameButton');
  if (newLang === 'zh') {
    startButton.src = 'img/startbuttonch.svg';
  } else if (newLang === 'ja') {
    startButton.src = 'img/startbuttonja.svg';
  } else {
    startButton.src = 'img/startbuttonen.svg';
  }

  console.log(`Language switched to: ${newLang}`);
} 