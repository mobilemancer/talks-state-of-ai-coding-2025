const canvas=document.getElementById("game");
const ctx=canvas.getContext("2d");
const scoreLabel=document.getElementById("score");
const livesLabel=document.getElementById("lives");
const levelLabel=document.getElementById("level");
const startOverlay=document.getElementById("startOverlay");
const powerModal=document.getElementById("powerModal");
const cell=24;
const player={x:canvas.width/2-cell/2,y:canvas.height-80,width:cell,height:cell,baseSpeed:220,baseFireDelay:320,speed:220,fireDelay:320,lastShot:0,lives:3};
let score=0;
let level=1;
let running=false;
let started=false;
const keys={};
const bullets=[];
let centipedes=[];
let mushrooms=[];
const powerUps=[];
const effectState={rapidFire:0,shield:0,spreadShot:0,piercing:0,doublePoints:0,playerSpeed:0,slowdown:0,freeze:0};
const timers=[];
let slowdownFactor=1;
let centipedeBaseInterval=420;
let lastTime=0;
const powerUpTypes=[
{key:"rapidFire",name:"Rapid Fire",color:"#ff2bd5",duration:9000,onApply:()=>{effectState.rapidFire++;refreshPlayerStats();},onExpire:()=>{effectState.rapidFire=Math.max(0,effectState.rapidFire-1);refreshPlayerStats();}},
{key:"shield",name:"Prism Shield",color:"#4cc9f0",duration:8000,onApply:()=>{effectState.shield++;},onExpire:()=>{effectState.shield=Math.max(0,effectState.shield-1);}},
{key:"extraLife",name:"Extra Life",color:"#ffbe0b",duration:0,onApply:()=>{player.lives++;updateHUD();}},
{key:"slowdown",name:"Stasis Pulse",color:"#5ef38c",duration:6000,onApply:()=>{effectState.slowdown++;refreshSpeedModifiers();},onExpire:()=>{effectState.slowdown=Math.max(0,effectState.slowdown-1);refreshSpeedModifiers();}},
{key:"spreadShot",name:"Tri-Beam",color:"#f15bb5",duration:8000,onApply:()=>{effectState.spreadShot++;},onExpire:()=>{effectState.spreadShot=Math.max(0,effectState.spreadShot-1);}},
{key:"piercing",name:"Phaser Core",color:"#ffee32",duration:8000,onApply:()=>{effectState.piercing++;},onExpire:()=>{effectState.piercing=Math.max(0,effectState.piercing-1);}},
{key:"doublePoints",name:"Score Surge",color:"#3a86ff",duration:10000,onApply:()=>{effectState.doublePoints++;},onExpire:()=>{effectState.doublePoints=Math.max(0,effectState.doublePoints-1);}},
{key:"playerSpeed",name:"Neon Dash",color:"#fb5607",duration:8000,onApply:()=>{effectState.playerSpeed++;refreshPlayerStats();},onExpire:()=>{effectState.playerSpeed=Math.max(0,effectState.playerSpeed-1);refreshPlayerStats();}},
{key:"mushroomBomb",name:"Crystal Burst",color:"#9d4edd",duration:0,onApply:()=>{clearMushroomsAround(player.x,player.y,120);}},
{key:"freeze",name:"Time Lock",color:"#b5179e",duration:5000,onApply:()=>{effectState.freeze++;},onExpire:()=>{effectState.freeze=Math.max(0,effectState.freeze-1);}}
];
const powerUpMap=Object.fromEntries(powerUpTypes.map(p=>[p.key,p]));
function refreshPlayerStats(){player.speed=player.baseSpeed+effectState.playerSpeed*70;player.fireDelay=Math.max(90,player.baseFireDelay-50*effectState.rapidFire);}
function refreshSpeedModifiers(){slowdownFactor=1/(1+effectState.slowdown*0.5);}
function spawnMushrooms(){mushrooms=[];const rows=8+level;for(let i=0;i<rows;i++){const count=4+Math.floor(Math.random()*4);for(let j=0;j<count;j++){const mx=Math.floor(Math.random()*(canvas.width/cell))*cell;const my=Math.floor(Math.random()*10+i)*cell;if(my>canvas.height-200)continue;if(distance(mx,my,player.x,player.y)<120)continue;if(!mushrooms.some(m=>m.x===mx&&m.y===my))mushrooms.push({x:mx,y:my,hp:3});}}}
function spawnCentipede(){const length=10+level;const centipede={segments:[],direction:1,interval:Math.max(140,centipedeBaseInterval-level*18),timer:0};for(let i=0;i<length;i++){centipede.segments.push({x:Math.floor(canvas.width/(2*cell))*cell-i*cell,y:cell});}centipedes=[centipede];}
function resetLevel(){bullets.length=0;powerUps.length=0;centipedes=[];spawnMushrooms();spawnCentipede();refreshPlayerStats();refreshSpeedModifiers();updateHUD();}
function startGame(){started=true;running=true;startOverlay.style.display="none";score=0;level=1;player.lives=3;player.x=canvas.width/2-cell/2;player.y=canvas.height-80;centipedeBaseInterval=420;resetLevel();}
function updateHUD(){scoreLabel.textContent=`Score: ${score}`;livesLabel.textContent=`Lives: ${player.lives}`;levelLabel.textContent=`Level: ${level}`;}
window.addEventListener("keydown",e=>{keys[e.code]=true;if(!started&&e.code==="Space"){startGame();}if(e.code==="Space"||e.code==="KeyZ")e.preventDefault();});
window.addEventListener("keyup",e=>{keys[e.code]=false;});
function shoot(now){if(now-player.lastShot<player.fireDelay)return;player.lastShot=now;const shots=[];shots.push({x:player.x+player.width/2,y:player.y,width:6,height:16,vy:-560,hits:effectState.piercing>0?1+effectState.piercing:1});if(effectState.spreadShot>0){const spread=Math.min(3,effectState.spreadShot+1);for(let i=1;i<=spread;i++){shots.push({x:player.x+player.width/2,y:player.y,width:6,height:16,vy:-560,vx:-120-40*i,hits:effectState.piercing>0?1+effectState.piercing:1});shots.push({x:player.x+player.width/2,y:player.y,width:6,height:16,vy:-560,vx:120+40*i,hits:effectState.piercing>0?1+effectState.piercing:1});}}shots.forEach(s=>{s.vx=s.vx||0;bullets.push(s);});}
function updatePlayer(dt){let dx=0,dy=0;if(keys["ArrowLeft"]||keys["KeyA"])dx-=1;if(keys["ArrowRight"]||keys["KeyD"])dx+=1;if(keys["ArrowUp"]||keys["KeyW"])dy-=1;if(keys["ArrowDown"]||keys["KeyS"])dy+=1;const mag=Math.hypot(dx,dy)||1;player.x+=dx/mag*player.speed*dt;player.y+=dy/mag*player.speed*dt;player.x=Math.max(0,Math.min(canvas.width-player.width,player.x));player.y=Math.max(canvas.height-260,Math.min(canvas.height-player.height,player.y));if(collidesWithMushroom(player))resolvePlayerObstacle();if((keys["Space"]||keys["KeyZ"])&&running)shoot(performance.now());}
function resolvePlayerObstacle(){for(const m of mushrooms){if(rectOverlap(player.x,player.y,player.width,player.height,m.x,m.y,cell,cell)){if(player.x+player.width/2<m.x+cell/2)player.x=m.x-player.width;else player.x=m.x+cell;}}}
function updateBullets(dt){for(let i=bullets.length-1;i>=0;i--){const b=bullets[i];b.y+=b.vy*dt;b.x+= (b.vx||0)*dt;if(b.y<-20||b.x<-20||b.x>canvas.width+20){bullets.splice(i,1);continue;}let hit=false;for(let j=centipedes.length-1;j>=0;j--){const cent=centipedes[j];for(let k=0;k<cent.segments.length;k++){const seg=cent.segments[k];if(rectOverlap(b.x,b.y,b.width,b.height,seg.x,seg.y,cell,cell)){handleSegmentHit(cent,k,b);hit=true;break;}}if(hit)break;}if(hit){b.hits--;if(b.hits<=0)bullets.splice(i,1);continue;}for(let m=mushrooms.length-1;m>=0;m--){const mush=mushrooms[m];if(rectOverlap(b.x,b.y,b.width,b.height,mush.x,mush.y,cell,cell)){mush.hp--;if(mush.hp<=0){maybeDropPowerUp(mush.x,mush.y);mushrooms.splice(m,1);score+=2*(1+effectState.doublePoints);updateHUD();}bullets.splice(i,1);hit=true;break;}}if(hit)continue;for(let p=powerUps.length-1;p>=0;p--){const pu=powerUps[p];if(circleRectOverlap(pu.x,pu.y,12,b.x,b.y,b.width,b.height)){collectPowerUp(pu);powerUps.splice(p,1);bullets.splice(i,1);break;}}}}
function handleSegmentHit(cent,index,bullet){const segment=cent.segments[index];score+=10*(1+effectState.doublePoints);updateHUD();maybeDropPowerUp(segment.x,segment.y);cent.segments.splice(index,1);if(index<cent.segments.length){const newCent={segments:cent.segments.splice(index),direction:cent.direction,interval:Math.max(90,cent.interval-20),timer:0};centipedes.push(newCent);}if(cent.segments.length===0){centipedes=centipedes.filter(c=>c!==cent);if(centipedes.length===0){nextLevel();}}}
function updateCentipedes(dt){for(const cent of centipedes){cent.timer+=dt*1000*slowdownFactor;if(effectState.freeze>0)continue;if(cent.timer<cent.interval)continue;cent.timer=0;const prevPositions=cent.segments.map(s=>({x:s.x,y:s.y}));const head=cent.segments[0];let newX=head.x+cent.direction*cell;let newY=head.y;if(newX<0||newX>canvas.width-cell||mushroomAt(newX,head.y)){newX=head.x;newY=head.y+cell;cent.direction*=-1;}head.x=newX;head.y=newY;for(let i=1;i<cent.segments.length;i++){cent.segments[i].x=prevPositions[i-1].x;cent.segments[i].y=prevPositions[i-1].y;}for(const seg of cent.segments){if(seg.y>=canvas.height-80){loseLife();break;}}}}
function loseLife(){if(effectState.shield>0){effectState.shield--;return;}player.lives--;updateHUD();if(player.lives<=0){running=false;started=false;startOverlay.style.display="flex";startOverlay.innerHTML="<h1>Game Over</h1><p>Press Space to reboot the arcade.</p>";}resetLevel();}
function nextLevel(){level++;score+=200*(1+effectState.doublePoints);centipedeBaseInterval=Math.max(160,centipedeBaseInterval-24);resetLevel();}
function updatePowerUps(dt){for(let i=powerUps.length-1;i>=0;i--){const pu=powerUps[i];pu.y+=pu.vy*dt;pu.phase+=dt*6;if(pu.y>canvas.height-40){powerUps.splice(i,1);continue;}if(circleRectOverlap(pu.x,pu.y,12,player.x,player.y,player.width,player.height)){collectPowerUp(pu);powerUps.splice(i,1);continue;}}}
function collectPowerUp(pu){const data=powerUpMap[pu.type];if(!data)return;data.onApply();if(data.duration>0){timers.push({type:data.key,expires:performance.now()+data.duration});}showPowerModal(data.name);}
function updateTimers(){const now=performance.now();for(let i=timers.length-1;i>=0;i--){const t=timers[i];if(now>=t.expires){const data=powerUpMap[t.type];if(data&&data.duration>0){data.onExpire();}timers.splice(i,1);}}}
function maybeDropPowerUp(x,y){if(Math.random()<0.32){const type=powerUpTypes[Math.floor(Math.random()*powerUpTypes.length)];powerUps.push({x:x+cell/2,y:y+cell/2,type:type.key,vy:60+Math.random()*40,phase:Math.random()*Math.PI*2,color:type.color});}}
function mushroomAt(x,y){return mushrooms.find(m=>m.x===x&&m.y===y);}function distance(x1,y1,x2,y2){return Math.hypot(x1-x2,y1-y2);}
function collidesWithMushroom(obj){return mushrooms.some(m=>rectOverlap(obj.x,obj.y,obj.width,obj.height,m.x,m.y,cell,cell));}
function rectOverlap(ax,ay,aw,ah,bx,by,bw,bh){return ax<bx+bw&&ax+aw>bx&&ay<by+bh&&ay+ah>by;}
function circleRectOverlap(cx,cy,cr,rx,ry,rw,rh){const x=Math.max(rx,Math.min(cx,rx+rw));const y=Math.max(ry,Math.min(cy,ry+rh));return (cx-x)*(cx-x)+(cy-y)*(cy-y)<=cr*cr;}
function clearMushroomsAround(x,y,r){mushrooms=mushrooms.filter(m=>distance(m.x,m.y,x,y)>r);} 
function draw(){ctx.clearRect(0,0,canvas.width,canvas.height);drawGrid();drawMushrooms();drawCentipedes();drawPlayer();drawBullets();drawPowerUps();}
function drawGrid(){ctx.strokeStyle="rgba(114,9,183,0.12)";ctx.lineWidth=1;for(let x=0;x<=canvas.width;x+=cell){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,canvas.height);ctx.stroke();}for(let y=0;y<=canvas.height;y+=cell){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(canvas.width,y);ctx.stroke();}}
function drawPlayer(){ctx.fillStyle="#f72585";ctx.shadowBlur=20;ctx.shadowColor="#f72585";ctx.fillRect(player.x,player.y,player.width,player.height);if(effectState.shield>0){ctx.strokeStyle="#4cc9f0";ctx.lineWidth=3;ctx.beginPath();ctx.arc(player.x+player.width/2,player.y+player.height/2,18,0,Math.PI*2);ctx.stroke();}ctx.shadowBlur=0;}
function drawBullets(){ctx.fillStyle="#ffee32";for(const b of bullets){ctx.fillRect(b.x-3,b.y,6,b.height);} }
function drawMushrooms(){for(const m of mushrooms){ctx.fillStyle="#7209b7";ctx.beginPath();ctx.ellipse(m.x+cell/2,m.y+cell/2,cell/2-2,cell/3,0,0,Math.PI*2);ctx.fill();ctx.fillStyle="#ffbe0b";ctx.fillRect(m.x+4,m.y+cell/2,cell-8,cell/2-4);} }
function drawCentipedes(){for(const cent of centipedes){cent.segments.forEach((seg,i)=>{const hue=(i*18+level*20)%360;ctx.fillStyle=`hsl(${hue},90%,60%)`;ctx.beginPath();ctx.arc(seg.x+cell/2,seg.y+cell/2,cell/2-2,0,Math.PI*2);ctx.fill();ctx.strokeStyle="#00f5d4";ctx.lineWidth=2;ctx.stroke();});}}
function drawPowerUps(){for(const pu of powerUps){const data=powerUpMap[pu.type];ctx.save();ctx.translate(pu.x,pu.y);ctx.rotate(Math.sin(pu.phase)*0.4);ctx.fillStyle=data.color;ctx.beginPath();ctx.arc(0,0,12,0,Math.PI*2);ctx.fill();ctx.strokeStyle="#ffffff";ctx.lineWidth=2;ctx.stroke();ctx.restore();}}
function showPowerModal(text){powerModal.textContent=text;powerModal.classList.remove("hidden");powerModal.classList.add("show");setTimeout(()=>{powerModal.classList.remove("show");setTimeout(()=>{powerModal.classList.add("hidden");},300);},1400);} 
function gameLoop(timestamp){if(!lastTime)lastTime=timestamp;const dt=(timestamp-lastTime)/1000;lastTime=timestamp;if(running){updatePlayer(dt);updateBullets(dt);updateCentipedes(dt);updatePowerUps(dt);updateTimers();checkPlayerHits();}draw();requestAnimationFrame(gameLoop);} 
function checkPlayerHits(){for(const cent of centipedes){for(const seg of cent.segments){if(rectOverlap(player.x,player.y,player.width,player.height,seg.x,seg.y,cell,cell)){loseLife();return;}}}}
resetLevel();draw();requestAnimationFrame(gameLoop);
