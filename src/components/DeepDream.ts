// Original hand-drawn-style underwater scene. CC0-1.0; no film/anime assets.
export function paintDeepDream(
  c: CanvasRenderingContext2D,
  width: number,
  height: number,
  t: number,
) {
  c.save();
  c.scale(width / 1000, height / 600);
  const sea = c.createLinearGradient(0, 0, 0, 600);
  sea.addColorStop(0, "#153d46");
  sea.addColorStop(0.5, "#09242f");
  sea.addColorStop(1, "#020e19");
  c.fillStyle = sea;
  c.fillRect(0, 0, 1000, 600);
  for (let i = 0; i < 5; i++) {
    const x = 160 + i * 160 + Math.sin(t * 0.1 + i) * 35;
    c.fillStyle = `rgba(112,184,175,${0.022 + i * 0.003})`;
    c.beginPath();
    c.moveTo(x, 0);
    c.lineTo(x + 40, 0);
    c.lineTo(x - 70, 590);
    c.lineTo(x - 270, 590);
    c.closePath();
    c.fill();
  }
  // Faint, submerged stone arches give the diver a sense of enormous scale.
  for (let i = 0; i < 7; i++) {
    const x = i * 165 - 40,
      y = 355 + Math.sin(i * 1.7) * 30;
    c.strokeStyle = "#47696b22";
    c.lineWidth = 16;
    c.beginPath();
    c.moveTo(x, y + 220);
    c.lineTo(x, y + 30);
    c.bezierCurveTo(x, y - 80, x + 100, y - 80, x + 100, y + 30);
    c.lineTo(x + 100, y + 220);
    c.stroke();
    c.strokeStyle = "#8caaa018";
    c.lineWidth = 1;
    c.stroke();
  }
  for (let j = 0; j < 3; j++) {
    c.save();
    const x = 160 + j * 330 + Math.sin(t * 0.12 + j) * 20,
      y = 200 + Math.sin(t * 0.25 + j) * 25 + j * 35;
    c.translate(x, y);
    const size = j === 0 ? 1.15 : 0.65;
    c.scale(size, size);
    const glow = c.createRadialGradient(0, 0, 4, 0, 0, 130);
    glow.addColorStop(0, "#91dfcf19");
    glow.addColorStop(1, "#91dfcf00");
    c.fillStyle = glow;
    c.fillRect(-140, -140, 280, 280);
    c.fillStyle = "#7dbdb822";
    c.strokeStyle = "#9ed0c055";
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(-70, 10);
    c.bezierCurveTo(-72, -90, 65, -90, 70, 10);
    c.bezierCurveTo(30, 30, -25, 0, -70, 10);
    c.fill();
    c.stroke();
    for (let k = 0; k < 9; k++) {
      const x = -53 + k * 13;
      c.beginPath();
      c.moveTo(x, 16);
      c.bezierCurveTo(
        x + Math.sin(t * 0.6 + k) * 25,
        70,
        x - 25,
        110,
        x + Math.cos(t * 0.45 + k) * 30,
        170 + (k % 3) * 12,
      );
      c.strokeStyle = "#87c8b52c";
      c.stroke();
    }
    c.restore();
  }
  // Small drifting figure, with ink outlines, loose hair and a flowing scarf.
  c.save();
  c.translate(540 + Math.sin(t * 0.14) * 16, 270 + Math.sin(t * 0.25) * 13);
  c.rotate(-0.27 + Math.sin(t * 0.2) * 0.045);
  c.scale(0.72, 0.72);
  c.lineJoin = "round";
  c.lineCap = "round";
  c.lineWidth = 2;
  c.strokeStyle = "#071b22";
  c.fillStyle = "#7c7e64";
  c.beginPath();
  c.moveTo(-4, -22);
  c.bezierCurveTo(-45, -4, -64, 22, -91, 9 + Math.sin(t * 0.65) * 9);
  c.bezierCurveTo(-75, 40, -38, 24, 2, -5);
  c.fill();
  c.stroke();
  c.fillStyle = "#afac8b";
  c.beginPath();
  c.moveTo(8, 42);
  c.lineTo(22, 79);
  c.lineTo(45, 101);
  c.lineTo(54, 98);
  c.lineTo(35, 73);
  c.lineTo(27, 35);
  c.closePath();
  c.fill();
  c.stroke();
  c.beginPath();
  c.moveTo(-14, 39);
  c.lineTo(-15, 78);
  c.lineTo(3, 108);
  c.lineTo(13, 105);
  c.lineTo(-1, 75);
  c.lineTo(4, 39);
  c.closePath();
  c.fill();
  c.stroke();
  c.fillStyle = "#64847b";
  c.beginPath();
  c.moveTo(-11, -15);
  c.bezierCurveTo(-32, 2, -27, 24, -43, 44);
  c.quadraticCurveTo(-5, 60, 36, 41);
  c.bezierCurveTo(17, 20, 29, 4, 11, -16);
  c.closePath();
  c.fill();
  c.stroke();
  c.fillStyle = "#a3aea0";
  c.beginPath();
  c.moveTo(14, -5);
  c.quadraticCurveTo(41, 10, 56, -2);
  c.lineTo(70, -16);
  c.lineTo(76, -12);
  c.quadraticCurveTo(62, 24, 39, 25);
  c.lineTo(18, 13);
  c.closePath();
  c.fill();
  c.stroke();
  c.fillStyle = "#c5bba0";
  c.beginPath();
  c.ellipse(2, -31, 14, 18, 0.14, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  c.fillStyle = "#303a33";
  c.beginPath();
  c.moveTo(-13, -23);
  c.bezierCurveTo(-28, -42, -5, -61, 14, -43);
  c.lineTo(17, -27);
  c.lineTo(8, -39);
  c.lineTo(1, -27);
  c.lineTo(-3, -39);
  c.bezierCurveTo(-13, -29, -15, -13, -31, -13 + Math.sin(t * 0.7) * 3);
  c.closePath();
  c.fill();
  c.stroke();
  c.strokeStyle = "#2c3430";
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(7, -28);
  c.lineTo(11, -28);
  c.stroke();
  c.strokeStyle = "#c2c6a93b";
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(-13, 2);
  c.quadraticCurveTo(2, 25, -15, 45);
  c.stroke();
  c.restore();
  for (let i = 0; i < 70; i++) {
    const x = (i * 197.13 + Math.sin(t * 0.1 + i) * 14) % 1000,
      y = (i * 83.7 - t * (2 + (i % 4)) + 12000) % 600;
    c.fillStyle = `rgba(157,202,183,${0.08 + (i % 4) * 0.035})`;
    c.beginPath();
    c.arc(x, y, 0.5 + (i % 3) * 0.5, 0, Math.PI * 2);
    c.fill();
  }
  for (let i = 0; i < 12; i++) {
    const x = ((i * 97 - t * 4 + 12000) % 1100) - 50,
      y = 160 + Math.sin(i * 2) * 50;
    c.fillStyle = "#a1c4b620";
    c.beginPath();
    c.ellipse(x, y, 6, 1.5, 0.1, 0, Math.PI * 2);
    c.fill();
  }
  const shade = c.createRadialGradient(520, 260, 90, 500, 300, 600);
  shade.addColorStop(0, "#0000");
  shade.addColorStop(1, "#0009");
  c.fillStyle = shade;
  c.fillRect(0, 0, 1000, 600);
  c.restore();
}
