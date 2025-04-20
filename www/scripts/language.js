import startButtonZH from 'img/start-button-zh.svg';
import startButtonJA from 'img/start-button-ja.svg';
import startButtonEN from 'img/start-button-en.svg';

export async function toggleLanguage() {
  const currentLang = document.documentElement.lang;
  const newLang = currentLang === 'en' ? 'zh' : (currentLang === 'zh' ? 'ja' : 'en');
  document.documentElement.lang = newLang;

  // 更新开始按钮图标
  const startButton = document.getElementById('startGameButton');
  if (newLang === 'zh') {
    startButton.src = startButtonZH;
  } else if (newLang === 'ja') {
    startButton.src = startButtonJA;
  } else {
    startButton.src = startButtonEN;
  }

  console.log(`Language switched to: ${newLang}`);
} 