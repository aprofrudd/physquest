import './ui/console.css';
import { startGame } from './game';

const root = document.getElementById('app');
if (root) startGame(root);
