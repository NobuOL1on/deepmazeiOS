import addTimeImage from '../img/add-time.svg';
import cornerSlowImage from '../img/corner-slow.svg';
import illuminateImage from '../img/illuminate.svg';
import slowCountdownImage from '../img/slow-countdown.svg';
import speedImage from '../img/speed.svg';
import teleportsImage from '../img/teleports.svg';
import throughWallsImage from '../img/through-walls.svg';
import timeStopImage from '../img/time-stop.svg';

export function getImage(skill) {
  console.log(skill.id);
  switch (skill.id) {
    case "wallPass":
      return throughWallsImage;
    case "timeStop":
      return timeStopImage;
    case "teleport":
      return teleportsImage;
    case "timeBoots":
      return addTimeImage;
    case "slowCountdown":
      return slowCountdownImage;
    case "cornerSlow":
      return cornerSlowImage;
    case "globalLight":
      return illuminateImage;
    case "speedBoost":
      return speedImage;
  }
}