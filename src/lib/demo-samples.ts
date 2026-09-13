/**
 * Generates synthetic high-resolution agronomic seed specimen canvas images
 * for one-click testing of healthy seeds, fungal diseased seeds, legumes, and non-seeds.
 */

export function generateDemoSample(type: "healthy-wheat" | "moldy-wheat" | "basmati-rice" | "chalky-rice" | "soybean-invalid" | "sunset-invalid"): { name: string; dataUrl: string } {
  const canvas = document.createElement("canvas");
  canvas.width = 400;
  canvas.height = 300;
  const ctx = canvas.getContext("2d");
  if (!ctx) return { name: "sample.jpg", dataUrl: "" };

  // Clear white studio background
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, 0, 400, 300);

  if (type === "healthy-wheat") {
    drawWheatGrain(ctx, 200, 150, 130, 65, 0.2, false);
    return { name: "prime-certified-wheat.jpg", dataUrl: canvas.toDataURL("image/jpeg", 0.9) };
  } else if (type === "moldy-wheat") {
    drawWheatGrain(ctx, 200, 150, 130, 65, 0.2, true);
    return { name: "fungal-blackpoint-wheat.jpg", dataUrl: canvas.toDataURL("image/jpeg", 0.9) };
  } else if (type === "basmati-rice") {
    drawRiceGrain(ctx, 200, 150, 150, 42, -0.3, false);
    return { name: "premium-basmati-rice.jpg", dataUrl: canvas.toDataURL("image/jpeg", 0.9) };
  } else if (type === "chalky-rice") {
    drawRiceGrain(ctx, 200, 150, 145, 45, -0.25, true);
    return { name: "fractured-chalky-rice.jpg", dataUrl: canvas.toDataURL("image/jpeg", 0.9) };
  } else if (type === "soybean-invalid") {
    drawSoybean(ctx, 200, 150, 65);
    return { name: "soybean-seed-sample.jpg", dataUrl: canvas.toDataURL("image/jpeg", 0.9) };
  } else {
    drawSunsetLandscape(ctx);
    return { name: "scenic-sunset-photo.jpg", dataUrl: canvas.toDataURL("image/jpeg", 0.9) };
  }
}

function drawWheatGrain(ctx: CanvasRenderingContext2D, cx: number, cy: number, length: number, width: number, angle: number, isMoldy: boolean) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);

  // Soft drop shadow
  ctx.shadowColor = "rgba(0,0,0,0.12)";
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 12;

  // Grain body gradient (Golden Amber)
  const grad = ctx.createRadialGradient(0, -10, 10, 0, 0, length / 2);
  grad.addColorStop(0, "#fde68a");
  grad.addColorStop(0.5, "#d97706");
  grad.addColorStop(1, "#92400e");

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(0, 0, length / 2, width / 2, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowColor = "transparent";

  // Longitudinal ventral crease
  ctx.strokeStyle = "rgba(120, 53, 15, 0.75)";
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(-length / 2 + 10, 0);
  ctx.quadraticCurveTo(0, 4, length / 2 - 12, 0);
  ctx.stroke();

  // Brush hairs at tip
  ctx.strokeStyle = "rgba(217, 119, 6, 0.7)";
  ctx.lineWidth = 1.2;
  for (let i = -10; i <= 10; i += 3) {
    ctx.beginPath();
    ctx.moveTo(length / 2 - 2, i);
    ctx.lineTo(length / 2 + 12 + Math.random() * 6, i + (Math.random() - 0.5) * 6);
    ctx.stroke();
  }

  // Fungal mold / black point mycelium
  if (isMoldy) {
    // Gray/black fungal patch covering brush end & tip
    const moldGrad = ctx.createRadialGradient(length / 2 - 10, 0, 4, length / 2 - 5, 0, 38);
    moldGrad.addColorStop(0, "rgba(28, 25, 23, 0.95)");
    moldGrad.addColorStop(0.5, "rgba(68, 64, 60, 0.85)");
    moldGrad.addColorStop(0.8, "rgba(120, 113, 108, 0.65)");
    moldGrad.addColorStop(1, "rgba(168, 162, 158, 0)");

    ctx.fillStyle = moldGrad;
    ctx.beginPath();
    ctx.ellipse(length / 2 - 8, 0, 32, width / 2 - 2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Fungal hyphae / mold mycelium hair texture
    ctx.strokeStyle = "rgba(41, 37, 36, 0.85)";
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 35; i++) {
      const rx = length / 2 - 28 + Math.random() * 32;
      const ry = (Math.random() - 0.5) * (width - 10);
      ctx.beginPath();
      ctx.moveTo(rx, ry);
      ctx.lineTo(rx + (Math.random() - 0.5) * 14, ry + (Math.random() - 0.5) * 14);
      ctx.stroke();
    }
  }

  ctx.restore();
}

function drawRiceGrain(ctx: CanvasRenderingContext2D, cx: number, cy: number, length: number, width: number, angle: number, isChalky: boolean) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);

  ctx.shadowColor = "rgba(0,0,0,0.1)";
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 8;

  // Slender translucent ivory gradient
  const grad = ctx.createRadialGradient(-15, -6, 8, 0, 0, length / 2);
  grad.addColorStop(0, "#ffffff");
  grad.addColorStop(0.6, "#fef3c7");
  grad.addColorStop(1, "#d97706");

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(0, 0, length / 2, width / 2, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowColor = "transparent";

  // Longitudinal lemma striation lines
  ctx.strokeStyle = "rgba(217, 119, 6, 0.35)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-length / 2 + 8, -6);
  ctx.lineTo(length / 2 - 8, -6);
  ctx.moveTo(-length / 2 + 6, 6);
  ctx.lineTo(length / 2 - 6, 6);
  ctx.stroke();

  if (isChalky) {
    // Chalky opaque fractured white belly
    ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
    ctx.beginPath();
    ctx.ellipse(0, 0, length / 3.5, width / 2.8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Internal micro-cracks
    ctx.strokeStyle = "rgba(180, 83, 9, 0.7)";
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(-15, -width / 2 + 4);
    ctx.lineTo(-5, width / 2 - 4);
    ctx.moveTo(10, -width / 2 + 5);
    ctx.lineTo(18, width / 2 - 5);
    ctx.stroke();
  }

  ctx.restore();
}

function drawSoybean(ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number) {
  ctx.save();
  ctx.translate(cx, cy);

  ctx.shadowColor = "rgba(0,0,0,0.15)";
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 10;

  // Spherical yellow-tan gradient
  const grad = ctx.createRadialGradient(-15, -15, 10, 0, 0, radius);
  grad.addColorStop(0, "#fef08a");
  grad.addColorStop(0.7, "#ca8a04");
  grad.addColorStop(1, "#854d0e");

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowColor = "transparent";

  // Distinct dark hilum scar on spherical side
  ctx.fillStyle = "#451a03";
  ctx.beginPath();
  ctx.ellipse(radius * 0.45, 0, 6, 18, 0.1, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawSunsetLandscape(ctx: CanvasRenderingContext2D) {
  // Sunset sky gradient
  const skyGrad = ctx.createLinearGradient(0, 0, 0, 180);
  skyGrad.addColorStop(0, "#312e81");
  skyGrad.addColorStop(0.3, "#db2777");
  skyGrad.addColorStop(0.7, "#f97316");
  skyGrad.addColorStop(1, "#fde047");

  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, 400, 180);

  // Sea reflection
  const seaGrad = ctx.createLinearGradient(0, 180, 0, 300);
  seaGrad.addColorStop(0, "#ea580c");
  seaGrad.addColorStop(0.5, "#431407");
  seaGrad.addColorStop(1, "#0f172a");

  ctx.fillStyle = seaGrad;
  ctx.fillRect(0, 180, 400, 120);

  // Dark mountain / castle silhouette
  ctx.fillStyle = "#09090b";
  ctx.beginPath();
  ctx.moveTo(0, 180);
  ctx.lineTo(80, 140);
  ctx.lineTo(130, 160);
  ctx.lineTo(210, 110);
  ctx.lineTo(260, 150);
  ctx.lineTo(340, 130);
  ctx.lineTo(400, 180);
  ctx.lineTo(400, 300);
  ctx.lineTo(0, 300);
  ctx.closePath();
  ctx.fill();
}
