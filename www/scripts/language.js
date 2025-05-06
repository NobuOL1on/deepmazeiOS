import startButtonZH from 'img/start-button-zh.svg';
import startButtonJA from 'img/start-button-ja.svg';
import startButtonEN from 'img/start-button-en.svg';
import backButtonEn from '../img/back-button-en.svg';
import backButtonZh from '../img/back-button-zh.svg';
import backButtonJa from '../img/back-button-ja.svg';
import timingModeButtonEn from '../img/timingmode-button-en.svg';
import timingModeButtonZh from '../img/timingmode-button-zh.svg';
import timingModeButtonJa from '../img/timingmode-button-ja.svg';
import infiniteModeButtonEn from '../img/infinitemode-button-en.svg';
import infiniteModeButtonZh from '../img/infinitemode-button-zh.svg';
import infiniteModeButtonJa from '../img/infinitemode-button-ja.svg';
import selectNormalBallEn from '../img/selectnormalball-en.svg';
import selectLargeBallEn from '../img/selectlargeball-en.svg';
import selectSmallBallEn from '../img/selectsmallball-en.svg';
import selectNormalBallZh from '../img/selectnormalball-zh.svg';
import selectLargeBallZh from '../img/selectlargeball-zh.svg';
import selectSmallBallZh from '../img/selectsmallball-zh.svg';
import selectNormalBallJa from '../img/selectnormalball-ja.svg';
import selectLargeBallJa from '../img/selectlargeball-ja.svg';
import selectSmallBallJa from '../img/selectsmallball-ja.svg';
import shopButtonEn from '../img/shop-button-en.svg';
import shopButtonZh from '../img/shop-button-zh.svg';
import shopButtonJa from '../img/shop-button-ja.svg';
import pauseButtonEn from '../img/pause-button-en.svg'
import pauseButtonZh from '../img/pause-button-zh.svg'
import pauseButtonJa from '../img/pause-button-ja.svg'

export function toggleLanguage() {
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

  // 更新其他按钮图标
  const backButton = document.getElementById('modeBackButton');
  const timingModeButton = document.getElementById('challengeModeButton');
  const infiniteModeButton = document.getElementById('infiniteModeButton');
  const pauseButton = document.getElementById('pause-button');

  if (newLang === 'zh') {
    backButton.src = backButtonZh;
    timingModeButton.src = timingModeButtonZh;
    infiniteModeButton.src = infiniteModeButtonZh;
    pauseButton.src = pauseButtonZh;
  } else if (newLang === 'ja') {
    backButton.src = backButtonJa;
    timingModeButton.src = timingModeButtonJa;
    infiniteModeButton.src = infiniteModeButtonJa;
    pauseButton.src = pauseButtonJa;
  } else {
    backButton.src = backButtonEn;
    timingModeButton.src = timingModeButtonEn;
    infiniteModeButton.src = infiniteModeButtonEn;
    pauseButton.src = pauseButtonEn;
  }

  // 更新小球选择图标
  const ballContainers = document.querySelectorAll('.ball-container img');
  if (newLang === 'zh') {
    ballContainers[0].src = selectNormalBallZh;
    ballContainers[1].src = selectLargeBallZh;
    ballContainers[2].src = selectSmallBallZh;
  } else if (newLang === 'ja') {
    ballContainers[0].src = selectNormalBallJa;
    ballContainers[1].src = selectLargeBallJa;
    ballContainers[2].src = selectSmallBallJa;
  } else {
    ballContainers[0].src = selectNormalBallEn;
    ballContainers[1].src = selectLargeBallEn;
    ballContainers[2].src = selectSmallBallEn;
  }

  // 更新商店按钮图标
  const shopButton = document.getElementById('shopButton');
  if (newLang === 'zh') {
    shopButton.src = shopButtonZh;
  } else if (newLang === 'ja') {
    shopButton.src = shopButtonJa;
  } else {
    shopButton.src = shopButtonEn;
  }

  console.log(`Language switched to: ${newLang}`);
} 