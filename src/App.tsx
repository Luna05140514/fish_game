/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Pause, RotateCcw } from 'lucide-react';

const cannonImg = new Image();
cannonImg.crossOrigin = "anonymous";
cannonImg.src = 'https://i.postimg.cc/6pYxZnb6/flash3.png';

const fishImages = [new Image(), new Image(), new Image(), new Image()];
fishImages[0].crossOrigin = "anonymous";
fishImages[0].src = 'https://i.postimg.cc/3NVSP4J4/fish4.png'; // 魚的圖片
fishImages[1].crossOrigin = "anonymous";
fishImages[1].src = 'https://i.postimg.cc/mkGb3D74/fish7.png'; // 魚的圖片
fishImages[2].crossOrigin = "anonymous";
fishImages[2].src = 'https://i.postimg.cc/hGh1L40v/fish6.png'; // 魚的圖片
fishImages[3].crossOrigin = "anonymous";
fishImages[3].src = 'https://i.postimg.cc/rw6wMfDQ/fish8.png'; // 魚的圖片

// 同樣建議加上 crossOrigin 避免報錯
fishImages.forEach((img, index) => {
  img.crossOrigin = "anonymous";
  img.onload = () => console.log(`Fish image ${index} loaded successfully`);
  img.onerror = () => console.error(`Failed to load fish image ${index}: ${img.src}`);
});

interface Fish {
  id: number;
  x: number;
  y: number;
  speed: number;
  size: number;
  direction: number; // 1 for right, -1 for left
  color: string;
  isDead: boolean;
  isStruggling: boolean;
  struggleTimeLeft: number;
  clicksNeeded: number;
  currentClicks: number;
  imageIndex: number;
}

interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fishRef = useRef<Fish[]>([]);
  const bulletsRef = useRef<Bullet[]>([]);
  const mousePosRef = useRef({ x: 0, y: 0 });
  const isStrugglingRef = useRef(false);
  const [score, setScore] = useState(0);
  const [strugglingFishIds, setStrugglingFishIds] = useState<number[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const isPausedRef = useRef(false);
  const [gameKey, setGameKey] = useState(0);

  const colors = ['#FFD700', '#FF4500', '#00CED1', '#FF69B4', '#ADFF2F'];
  
  const createFish = (id: number): Fish => {
    const size = 30 + Math.random() * 60;
    
    let imageIndex = Math.floor(Math.random() * fishImages.length);
    if (imageIndex === 3) {
      const hasFish3 = fishRef.current.some(f => f.imageIndex === 3 && !f.isDead);
      if (hasFish3) {
        imageIndex = Math.floor(Math.random() * 3);
      }
    }

    return {
      id,
      x: Math.random() > 0.5 ? -100 : window.innerWidth + 100,
      y: 100 + Math.random() * (window.innerHeight - 300),
      speed: 0.8 + Math.random() * 1.5,
      size,
      direction: 0,
      color: colors[Math.floor(Math.random() * colors.length)],
      isDead: false,
      isStruggling: false,
      struggleTimeLeft: 0,
      clicksNeeded: Math.max(2, Math.floor(size / 10) - 1),
      currentClicks: 0,
      imageIndex,
    };
  };

  const handleRestart = () => {
    setScore(0);
    setStrugglingFishIds([]);
    setIsPaused(false);
    isPausedRef.current = false;
    isStrugglingRef.current = false;
    bulletsRef.current = [];
    setGameKey(prev => prev + 1);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    fishRef.current = [];
    for (let i = 0; i < 10; i++) {
      const f = createFish(i);
      f.x = Math.random() * canvas.width;
      f.direction = Math.random() > 0.5 ? 1 : -1;
      fishRef.current.push(f);
    }

    const handleMouseMove = (e: MouseEvent) => {
      mousePosRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleClick = (e: MouseEvent) => {
      // Don't fire if clicking UI buttons (handled by React)
      if ((e.target as HTMLElement).tagName === 'BUTTON') return;

      // Don't fire if a fish is currently struggling (Reel In button is visible)
      if (isStrugglingRef.current) return;

      // Don't fire if paused
      if (isPausedRef.current) return;

      const centerX = canvas.width / 2;
      const centerY = canvas.height;
      const dx = e.clientX - centerX;
      const dy = e.clientY - centerY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      const speed = 12;
      bulletsRef.current.push({
        x: centerX,
        y: centerY,
        vx: (dx / distance) * speed,
        vy: (dy / distance) * speed,
        radius: 8,
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('click', handleClick);

    let animationFrameId: number;

    const drawFish = (fish: Fish) => {
     if (fish.isDead) return;
      
      // --- 第一部分：繪製魚的本體 (包含震動與翻轉) ---
      ctx.save();
      
      // 1. 掙扎時的震動位移
      let offsetX = 0;
      let offsetY = 0;
      if (fish.isStruggling) {
        offsetX = (Math.random() - 0.5) * 10;
        offsetY = (Math.random() - 0.5) * 10;
      }

      // 2. 移動畫布到魚的位置
      ctx.translate(fish.x + offsetX, fish.y + offsetY);
      
      // 3. 處理轉向：如果是向左游 (direction 為 -1)，就水平翻轉
      if (fish.direction === -1) {
        ctx.scale(-1, 1);
      }

      // 4. 取得對應的圖片並畫出來
      const img = fishImages[fish.imageIndex];
      if (img && img.complete && img.naturalWidth > 0) {
        // 畫出魚圖 (置中對齊，寬度為 size*2，高度為 size)
        ctx.drawImage(img, -fish.size, -fish.size / 2, fish.size * 2, fish.size);
      } else {
        // 圖片還沒載入前的備用方塊 (避免畫面全黑)
        ctx.fillStyle = fish.color;
        ctx.fillRect(-fish.size, -fish.size / 2, fish.size * 2, fish.size);
      }

      ctx.restore(); // 結束魚本體的繪製

      // --- 第二部分：繪製掙扎進度條 (這部分不跟著魚翻轉，所以寫在 restore 後面) ---
      if (fish.isStruggling) {
        ctx.save();
        ctx.translate(fish.x, fish.y - fish.size - 20); // 在魚的上方顯示
        
        // 1. 進度條背景 (黑底)
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(-30, 0, 60, 8);
        
        // 2. 點擊進度 (綠條)
        const progress = fish.currentClicks / fish.clicksNeeded;
        ctx.fillStyle = '#00ff00';
        ctx.fillRect(-30, 0, 60 * progress, 8);
        
        // 3. 剩餘時間條 (紅條)
        const timeProgress = fish.struggleTimeLeft / 5000;
        ctx.fillStyle = '#ff3333';
        ctx.fillRect(-30, 10, 60 * timeProgress, 8);
        
        ctx.restore();
      }
    };

    const drawCannon = () => {
      const centerX = canvas.width / 2;
      const centerY = canvas.height;
      const dx = mousePosRef.current.x - centerX;
      const dy = mousePosRef.current.y - centerY;
      const angle = Math.atan2(dy, dx);

      ctx.save();
      ctx.translate(centerX, centerY);
      // 加上 Math.PI / 2 (90度) 偏移量，讓朝上的圖片能精準指向滑鼠
      ctx.rotate(angle + Math.PI / 2);

      const targetWidth = 150;
      const targetHeight = cannonImg.naturalWidth ? (targetWidth * cannonImg.naturalHeight / cannonImg.naturalWidth) : 120;

      if (cannonImg.complete && cannonImg.naturalWidth > 0) {
        // 以底部中心點為軸心，所以 x 往左偏移一半寬度，y 往上偏移整個高度
        ctx.drawImage(cannonImg, -targetWidth / 2, -targetHeight, targetWidth, targetHeight);
      } else {
        // 載入失敗的備用繪製
        ctx.beginPath();
        ctx.arc(0, 0, 45, Math.PI, 0);
        ctx.fillStyle = '#1a1a1a';
        ctx.fill();
        ctx.fillStyle = '#333';
        ctx.fillRect(-35, -54, 70, 36);
      }

      ctx.restore();
    };

    let lastTime = performance.now();

    const render = (time: number) => {
      const deltaTime = time - lastTime;
      lastTime = time;

      if (isPausedRef.current) {
        animationFrameId = requestAnimationFrame(render);
        return;
      }

      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Update bullets
      bulletsRef.current = bulletsRef.current.filter(bullet => {
        bullet.x += bullet.vx;
        bullet.y += bullet.vy;

        ctx.beginPath();
        ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
        ctx.fillStyle = '#ffff00';
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#ffff00';
        ctx.fill();
        ctx.shadowBlur = 0;

        fishRef.current.forEach(fish => {
          if (!fish.isDead && !fish.isStruggling) {
            const dx = bullet.x - fish.x;
            const dy = bullet.y - fish.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < fish.size + bullet.radius) {
              // Large fish struggle (size > 35)
              if (fish.size > 35) {
                fish.isStruggling = true;
                fish.struggleTimeLeft = 5000;
                fish.currentClicks = 0;
              } else {
                fish.isDead = true;
                setScore(prev => prev + 50);
                setTimeout(() => respawnFish(fish.id), 2000);
              }
              return false; // Bullet consumed
            }
          }
        });

        return bullet.x > 0 && bullet.x < canvas.width && bullet.y > 0 && bullet.y < canvas.height;
      });

      // Collision avoidance between fish (讓魚互相避開，不要重疊)
      for (let i = 0; i < fishRef.current.length; i++) {
        for (let j = i + 1; j < fishRef.current.length; j++) {
          const f1 = fishRef.current[i];
          const f2 = fishRef.current[j];
          if (f1.isDead || f2.isDead) continue;

          const dx = f1.x - f2.x;
          const dy = f1.y - f2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          // 魚的寬度是 size*2，高度是 size。設定安全距離避免重疊
          const minDist = f1.size + f2.size + 80; 

          if (dist < minDist && dist > 0) {
            // 當兩隻魚太靠近時，在 Y 軸上產生排斥力把牠們推開
            const overlap = minDist - dist;
            const pushForce = overlap * 0.1;
            
            if (f1.y < f2.y) {
              f1.y -= pushForce;
              f2.y += pushForce;
            } else {
              f1.y += pushForce;
              f2.y -= pushForce;
            }
            
            // 確保魚不會被擠出畫面外 (上方留 100，下方留 300)
            f1.y = Math.max(100, Math.min(canvas.height - 200, f1.y));
            f2.y = Math.max(100, Math.min(canvas.height - 200, f2.y));
          }
        }
      }

      // Update fish
      const currentStrugglingIds: number[] = [];
      fishRef.current.forEach((fish) => {
        if (!fish.isDead) {
          if (fish.isStruggling) {
            fish.struggleTimeLeft -= deltaTime;
            if (fish.struggleTimeLeft <= 0) {
              fish.isStruggling = false; // Escaped
            } else {
              currentStrugglingIds.push(fish.id);
              
              // 繪製從大砲連到魚身上的「收線」釣線與魚鉤
              ctx.save();
              
              // 1. 畫白色的釣線
              ctx.beginPath();
              ctx.moveTo(canvas.width / 2, canvas.height);
              ctx.lineTo(fish.x, fish.y);
              ctx.strokeStyle = '#ffffff'; // 白色實線
              ctx.lineWidth = 1.5;
              ctx.shadowColor = '#ffffff';
              ctx.shadowBlur = 4;
              ctx.stroke();
              
              // 2. 畫魚鉤 (在魚的位置)
              const angle = Math.atan2(fish.y - canvas.height, fish.x - canvas.width / 2);
              ctx.translate(fish.x, fish.y);
              ctx.rotate(angle);
              
              ctx.beginPath();
              ctx.moveTo(0, 0); // 從線的末端開始
              ctx.lineTo(15, 0); // 魚鉤的直柄
              ctx.arc(15, 8, 8, -Math.PI / 2, Math.PI / 2); // 魚鉤的彎曲部分
              ctx.lineTo(10, 12); // 魚鉤的尖端 (倒刺往回勾)
              
              ctx.strokeStyle = '#d1d5db'; // 銀灰色魚鉤
              ctx.lineWidth = 3;
              ctx.lineCap = 'round';
              ctx.lineJoin = 'round';
              ctx.shadowBlur = 2; // 魚鉤微微的立體感
              ctx.shadowColor = '#000000';
              ctx.stroke();
              
              ctx.restore();
            }
          } else {
            fish.x += fish.speed * fish.direction;
            if (fish.direction === 1 && fish.x > canvas.width + 100) {
              fish.x = -100;
              fish.y = 100 + Math.random() * (canvas.height - 300);
            }
            if (fish.direction === -1 && fish.x < -100) {
              fish.x = canvas.width + 100;
              fish.y = 100 + Math.random() * (canvas.height - 300);
            }
          }
          drawFish(fish);
        }
      });

      isStrugglingRef.current = currentStrugglingIds.length > 0;
      setStrugglingFishIds(currentStrugglingIds);
      drawCannon();
      animationFrameId = requestAnimationFrame(render);
    };

    const respawnFish = (id: number) => {
      const index = fishRef.current.findIndex(f => f.id === id);
      if (index !== -1) {
        const newFish = createFish(id);
        newFish.direction = Math.random() > 0.5 ? 1 : -1;
        newFish.x = newFish.direction === 1 ? -100 : canvas.width + 100;
        fishRef.current[index] = newFish;
      }
    };

    const startGame = () => {
      lastTime = performance.now();
      animationFrameId = requestAnimationFrame(render);
    };

   // 不管圖片了，直接啟動遊戲！
    startGame();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('click', handleClick);
      cancelAnimationFrame(animationFrameId);
    };
  }, [gameKey]);

  const handleReelIn = () => {
    if (strugglingFishIds.length === 0) return;
    
    // Reel in the first struggling fish
    const targetId = strugglingFishIds[0];
    const fish = fishRef.current.find(f => f.id === targetId);
    
    if (fish && fish.isStruggling) {
      fish.currentClicks += 1;
      if (fish.currentClicks >= fish.clicksNeeded) {
        fish.isStruggling = false;
        fish.isDead = true;
        setScore(prev => prev + 500); // Big fish worth more
        
        // Respawn logic
        setTimeout(() => {
          const index = fishRef.current.findIndex(f => f.id === targetId);
          if (index !== -1) {
            const newFish = createFish(targetId);
            newFish.direction = Math.random() > 0.5 ? 1 : -1;
            newFish.x = newFish.direction === 1 ? -100 : window.innerWidth + 100;
            fishRef.current[index] = newFish;
          }
        }, 2000);
      }
    }
  };

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black select-none">
      <canvas
        ref={canvasRef}
        id="gameCanvas"
        className="block w-full h-full cursor-crosshair"
      />
      
      {/* HUD Overlay */}
      <div className="absolute top-8 left-8 text-white pointer-events-none">
        
        <div className="flex flex-col gap-1 mt-2">
          
          <p className="font-mono text-2xl text-yellow-400 font-bold drop-shadow-[0_0_10px_rgba(250,204,21,0.5)]">
            捕魚分數 {score.toString().padStart(6, '0')}
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="absolute top-8 right-8 z-50 flex gap-4">
        <button
          onClick={() => {
            setIsPaused(prev => {
              const next = !prev;
              isPausedRef.current = next;
              return next;
            });
          }}
          className="flex items-center justify-center w-12 h-12 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold rounded-lg backdrop-blur-sm transition-all shadow-[0_0_15px_rgba(255,255,255,0.1)] hover:shadow-[0_0_20px_rgba(255,255,255,0.3)] active:scale-95"
          title={isPaused ? '繼續遊戲' : '暫停'}
        >
          {isPaused ? <Play className="w-6 h-6 fill-current" /> : <Pause className="w-6 h-6 fill-current" />}
        </button>
        <button
          onClick={handleRestart}
          className="flex items-center justify-center w-12 h-12 bg-red-500/80 hover:bg-red-500 border border-red-500/50 text-white font-bold rounded-lg backdrop-blur-sm transition-all shadow-[0_0_15px_rgba(239,68,68,0.3)] hover:shadow-[0_0_20px_rgba(239,68,68,0.5)] active:scale-95"
          title="重新開始"
        >
          <RotateCcw className="w-6 h-6" />
        </button>
      </div>

      {/* Reel In Button */}
      <AnimatePresence>
        {strugglingFishIds.length > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5, y: 50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.5, y: 50 }}
            className="absolute bottom-32 left-1/2 -translate-x-1/2 flex flex-col items-center gap-4"
          >
          
            <button
              onClick={handleReelIn}
              className="group relative px-12 py-6 bg-yellow-500 hover:bg-yellow-400 text-black font-black text-2xl uppercase italic tracking-widest rounded-xl shadow-[0_0_30px_rgba(234,179,8,0.4)] transition-all active:scale-95"
            >
              <span className="relative z-10">用力拉釣魚線</span>
              <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl" />
            </button>
           
          </motion.div>
        )}
      </AnimatePresence>

      
    </div>
  );
}
