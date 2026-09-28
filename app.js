const API="https://lidgvyhsytwwfndsmeic.supabase.co/functions/v1/mlb-prediction";
const app=document.getElementById("app");
let token=localStorage.getItem("mlb_token")||"";
let state=null,view="games",role="player",actorId="p1",busy=false;

const esc=v=>String(v??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const jst=d=>new Date(d).toLocaleString("ja-JP",{timeZone:"Asia/Tokyo",month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"});
const isLocked=(d,status="scheduled")=>new Date(d)<=new Date(state?.serverTime||Date.now())||status!=="scheduled";
function setBusy(v){busy=v;const e=document.getElementById("busy");if(e)e.classList.toggle("hidden",!v)}
async function api(action,payload={}){
  const res=await fetch(API,{method:"POST",headers:{"content-type":"application/json","x-session-token":token},body:JSON.stringify({action,payload})});
  let body={};try{body=await res.json()}catch{}
  if(!res.ok)throw new Error(body.error||"通信エラー");
  return body;
}
function errorText(err){const t=String(err?.message||err||"エラーが発生しました");if(t==="unauthorized")return"セッションが切れました。再ログインしてください。";return t}
function logoutLocal(){token="";state=null;localStorage.removeItem("mlb_token");renderLogin()}
function renderLogin(){
  app.innerHTML=`
  <section class="login-shell">
    <div style="width:min(480px,100%)">
      <div class="brand"><div class="eyebrow">5 PLAYER PRIVATE GAME</div><h1>MLB<br>POSTSEASON<br><span>PREDICTION</span></h1></div>
      <div class="login-card">
        <div class="role-switch">
          <button id="rolePlayer" class="btn">PLAYER</button>
          <button id="roleAdmin" class="btn secondary">ADMIN</button>
        </div>
        <div id="playerGrid" class="player-grid">
          ${[1,2,3,4,5].map(n=>`<button class="btn ${n===1?"active":"secondary"}" data-player="p${n}">P${n}</button>`).join("")}
        </div>
        <label class="label">4桁PIN</label>
        <input id="pin" class="field" maxlength="4" inputmode="numeric" autocomplete="one-time-code" placeholder="0000">
        <button id="loginBtn" class="btn" style="margin-top:10px;width:100%">LOGIN</button>
        <div id="loginError" class="error"></div>
      </div>
    </div>
  </section>`;
  const pg=document.getElementById("playerGrid"),rp=document.getElementById("rolePlayer"),ra=document.getElementById("roleAdmin");
  rp.onclick=()=>{role="player";actorId="p1";pg.classList.remove("hidden");rp.className="btn";ra.className="btn secondary";[...document.querySelectorAll("[data-player]")].forEach((b,i)=>b.className="btn "+(i?"secondary":"active"))};
  ra.onclick=()=>{role="admin";actorId="admin";pg.classList.add("hidden");ra.className="btn";rp.className="btn secondary"};
  document.querySelectorAll("[data-player]").forEach(b=>b.onclick=()=>{actorId=b.dataset.player;document.querySelectorAll("[data-player]").forEach(x=>x.className="btn "+(x===b?"active":"secondary"))});
  document.getElementById("loginBtn").onclick=async()=>{
    const pin=document.getElementById("pin").value.trim(),er=document.getElementById("loginError");
    er.textContent="";
    if(!/^\d{4}$/.test(pin)){er.textContent="4桁のPINを入力してください。";return}
    try{
      const j=await api("login",{actorId,pin});
      token=j.token;localStorage.setItem("mlb_token",token);await refresh();
    }catch(e){er.textContent=errorText(e)}
  };
}
async function refresh(){
  try{state=await api("state");render()}catch(e){logoutLocal()}
}
function shell(body){
  return `<div class="shell">
    <header class="topbar"><div class="topbar-row"><div><div class="eyebrow">MLB POSTSEASON PREDICTION · 2026</div><h2>${esc(state.actor.display_name)}</h2></div><button id="logout" class="btn ghost small">LOGOUT</button></div></header>
    <main class="content">${body}</main>
    <nav class="nav">
      ${[["games","GAME"],["series","SERIES"],["rank","RANK"],["pre","PRE"],["admin","ADMIN"]].filter(x=>x[0]!=="admin"||state.actor.role==="admin").map(([k,l])=>`<button data-view="${k}" class="${view===k?"active":""}">${l}</button>`).join("")}
    </nav>
    <div id="busy" class="loading-overlay hidden"><div class="loading-box"><div class="spinner"></div><div class="muted" style="margin-top:8px">更新中...</div></div></div>
  </div>`;
}
function budgetCard(){
  if(!state.budget)return"";
  const b=state.budget;
  return `<section class="card"><div class="muted">残り使用可能</div><div class="metric">${b.available}P</div>
  <div class="budget-row">
    <span class="pill">自由枠 ${b.freeRemaining}P</span>
    <span class="pill">WCS ${b.spentByRound.WCS}/20</span><span class="pill">DS ${b.spentByRound.DS}/30</span>
    <span class="pill">LCS ${b.spentByRound.LCS}/20</span><span class="pill">WS ${b.spentByRound.WS}/10</span>
  </div></section>`;
}
function gamesView(){
  let out=budgetCard();
  for(const g of state.games){
    const s=state.series.find(x=>x.id===g.series_id),p=state.gamePredictions.find(x=>x.game_id===g.id&&x.actor_id===state.actor.id);
    const lock=isLocked(g.starts_at,g.status);
    const pill=g.status==="final"?'<span class="pill final">FINAL</span>':lock?'<span class="pill lock">LOCK</span>':'<span class="pill live">OPEN</span>';
    out+=`<section class="card">
      <div class="status-line"><div class="muted">${esc(s?.round||"")} · ${jst(g.starts_at)}</div>${pill}</div>
      <div class="game-title">${esc(g.away_team)} <span class="muted">@</span> ${esc(g.home_team)}</div>
      ${g.status==="final"?`<div style="text-align:center;font-weight:900;margin-bottom:10px">FINAL ${g.away_score} - ${g.home_score}</div>`:""}
      ${state.actor.role==="player"?`
      <div class="score-grid">
        <div><div class="team">${esc(g.away_team)}</div><input id="aw_${g.id}" class="field" type="number" min="0" max="30" value="${p?.away_score??""}" ${lock?"disabled":""}></div>
        <div><label class="label" style="text-align:center">POINT</label><input id="st_${g.id}" class="field" type="number" min="1" max="10" value="${p?.stake??1}" ${lock?"disabled":""}></div>
        <div><div class="team">${esc(g.home_team)}</div><input id="ho_${g.id}" class="field" type="number" min="0" max="30" value="${p?.home_score??""}" ${lock?"disabled":""}></div>
      </div>
      <div class="boost-row"><label class="boost"><input id="bo_${g.id}" type="checkbox" ${p?.boost?"checked":""} ${lock?"disabled":""}> BOOST</label><span class="tiny">各ラウンド1回</span></div>
      ${lock?"":`<button class="btn" style="width:100%" data-save-game="${g.id}">予想を保存</button>`}
      ${p?'<div class="notice" style="margin-top:8px">保存済み：'+p.away_score+'-'+p.home_score+' / '+p.stake+'P'+(p.boost?' / BOOST':'')+'</div>':""}
      `:""}
    </section>`;
  }
  return out;
}
function seriesView(){
  return state.series.map(s=>{
    const p=state.seriesPredictions.find(x=>x.series_id===s.id&&x.actor_id===state.actor.id),lock=isLocked(s.starts_at,s.status),need=s.round==="WCS"?2:s.round==="DS"?3:4;
    return `<section class="card"><div class="status-line"><div class="muted">${esc(s.round)} · ${jst(s.starts_at)}</div>${lock?'<span class="pill lock">LOCK</span>':'<span class="pill live">OPEN</span>'}</div>
      <div class="game-title">${esc(s.team_a)} <span class="muted">vs</span> ${esc(s.team_b)}</div>
      ${s.status==="final"?`<div class="notice">${esc(s.winner_team)} WIN · ${s.wins_a}-${s.wins_b}</div>`:""}
      ${state.actor.role==="player"?`
        <label class="label">シリーズ勝者</label><select id="sw_${s.id}" class="field" ${lock?"disabled":""}><option value="${esc(s.team_a)}" ${p?.winner_team===s.team_a?"selected":""}>${esc(s.team_a)}</option><option value="${esc(s.team_b)}" ${p?.winner_team===s.team_b?"selected":""}>${esc(s.team_b)}</option></select>
        <label class="label">シリーズスコア</label><select id="sl_${s.id}" class="field" ${lock?"disabled":""}>${Array.from({length:need},(_,n)=>`<option value="${n}" ${+p?.loser_wins===n?"selected":""}>${need}-${n}</option>`).join("")}</select>
        <div class="boost-row"><label><input id="su_${s.id}" type="checkbox" ${p?.upset?"checked":""} ${lock?"disabled":""}> UPSET BONUS</label><span class="tiny">下位シード勝利</span></div>
        ${lock?"":`<button class="btn" style="width:100%" data-save-series="${s.id}">シリーズ予想を保存</button>`}
      `:""}
    </section>`
  }).join("");
}
function rankView(){
  return `<section class="card"><div class="section-title"><h3>RANKING</h3><span class="pill">${state.ranking.length} PLAYERS</span></div>
  ${state.ranking.map((x,i)=>`<div class="rank-row"><div class="rank-no">${i+1}</div><div><b>${esc(x.player.display_name)}</b><div class="tiny">GAME ${x.game} / SERIES ${x.series} / PRE ${x.pre} / 残 ${x.remaining}P</div></div><div class="rank-score">${x.total}P</div></div>`).join("")}</section>`;
}
function preView(){
  const p=state.prePredictions.find(x=>x.actor_id===state.actor.id),lock=state.config.pre_lock_at&&new Date(state.config.pre_lock_at)<=new Date(state.serverTime);
  return `<section class="card"><div class="section-title"><h3>大会前予想</h3>${lock?'<span class="pill lock">LOCK</span>':'<span class="pill live">OPEN</span>'}</div>
  <div class="muted">締切：${jst(state.config.pre_lock_at)}</div>
  ${state.actor.role==="player"?`
  <label class="label">AL優勝</label><input id="preAL" class="field" value="${esc(p?.al_champion||"")}" ${lock?"disabled":""} placeholder="例: NYY">
  <label class="label">NL優勝</label><input id="preNL" class="field" value="${esc(p?.nl_champion||"")}" ${lock?"disabled":""} placeholder="例: LAD">
  <label class="label">WS優勝</label><input id="preWS" class="field" value="${esc(p?.ws_champion||"")}" ${lock?"disabled":""} placeholder="AL/NL優勝予想のどちらか">
  <label class="label">WSシリーズスコア</label><select id="preLW" class="field" ${lock?"disabled":""}>${[0,1,2,3].map(n=>`<option value="${n}" ${+p?.ws_loser_wins===n?"selected":""}>4-${n}</option>`).join("")}</select>
  ${lock?"":'<button id="savePre" class="btn" style="width:100%;margin-top:10px">大会前予想を保存</button>'}
  `:''}</section>`;
}
function adminView(){
  if(state.actor.role!=="admin")return "";
  const names=state.players.map(p=>`<label class="label">${esc(p.id.toUpperCase())}</label><input class="field" id="nm_${p.id}" value="${esc(p.display_name)}">`).join("");
  const gameRows=state.games.map(g=>`<div class="admin-block"><div class="muted">${esc(g.away_team)} @ ${esc(g.home_team)} · ${jst(g.starts_at)}</div><div class="three-col" style="margin-top:7px"><input class="field" id="ra_${g.id}" type="number" placeholder="Away" value="${g.away_score??""}"><input class="field" id="rh_${g.id}" type="number" placeholder="Home" value="${g.home_score??""}"><button class="btn" data-result="${g.id}">FINAL</button></div></div>`).join("");
  return `
  <details class="card" open><summary>PLAYER設定</summary><div class="admin-block">${names}<button id="saveNames" class="btn" style="width:100%;margin-top:10px">名前を保存</button></div>
    <div class="admin-block"><h3>PIN変更</h3><div class="two-col mobile-stack"><select id="pinPlayer" class="field">${state.players.map(p=>`<option value="${p.id}">${esc(p.display_name)}</option>`).join("")}<option value="admin">ADMIN</option></select><input id="newPin" class="field" maxlength="4" inputmode="numeric" placeholder="新しい4桁PIN"></div><button id="savePin" class="btn danger" style="width:100%;margin-top:8px">PINを変更</button></div>
  </details>
  <details class="card"><summary>試合結果</summary>${gameRows}</details>
  <details class="card"><summary>ラウンド終了</summary><div class="admin-block">${state.rounds.map(r=>`<button class="btn ${r.closed?"secondary":""}" style="width:100%;margin:4px 0" data-round="${r.round}" data-closed="${r.closed}">${r.round} ${r.closed?"REOPEN":"CLOSE"}</button>`).join("")}</div></details>
  <details class="card"><summary>大会前予想管理</summary><div class="admin-block"><label class="label">締切日時</label><input id="preLock" class="field" type="datetime-local" value="${new Date(state.config.pre_lock_at).toISOString().slice(0,16)}"><button id="savePreLock" class="btn" style="width:100%;margin-top:8px">締切を更新</button></div>
    <div class="admin-block"><label class="label">AL優勝</label><input id="actualAL" class="field" placeholder="例: NYY"><label class="label">NL優勝</label><input id="actualNL" class="field" placeholder="例: LAD"><label class="label">WS優勝</label><input id="actualWS" class="field" placeholder="例: LAD"><label class="label">WSスコア</label><select id="actualLW" class="field">${[0,1,2,3].map(n=>`<option value="${n}">4-${n}</option>`).join("")}</select><button id="savePreResult" class="btn danger" style="width:100%;margin-top:8px">最終結果を確定・採点</button></div>
  </details>
  <details class="card"><summary>シリーズ/試合登録</summary><div class="admin-block">
    <div class="notice">DS/LCS/WSや開始時刻変更用。既存IDを空欄にすると新規登録。</div>
    <label class="label">シリーズID（編集時のみ）</label><input id="seriesId" class="field">
    <div class="two-col"><div><label class="label">Code</label><input id="seriesCode" class="field"></div><div><label class="label">League</label><select id="seriesLeague" class="field"><option>AL</option><option>NL</option></select></div></div>
    <label class="label">Round</label><select id="seriesRound" class="field"><option>WCS</option><option>DS</option><option>LCS</option><option>WS</option></select>
    <div class="two-col"><div><label class="label">Team A</label><input id="teamA" class="field"></div><div><label class="label">Team B</label><input id="teamB" class="field"></div></div>
    <div class="two-col"><div><label class="label">Seed A</label><input id="seedA" class="field" type="number"></div><div><label class="label">Seed B</label><input id="seedB" class="field" type="number"></div></div>
    <label class="label">開始日時</label><input id="seriesStart" class="field" type="datetime-local"><button id="saveSeriesAdmin" class="btn" style="width:100%;margin-top:8px">シリーズ保存</button>
    <div class="sep"></div>
    <label class="label">Game ID（編集時のみ）</label><input id="gameId" class="field"><label class="label">Series ID</label><input id="gameSeriesId" class="field">
    <div class="three-col"><div><label class="label">Game No</label><input id="gameNo" class="field" type="number" min="1" max="7"></div><div><label class="label">Away</label><input id="gameAway" class="field"></div><div><label class="label">Home</label><input id="gameHome" class="field"></div></div>
    <label class="label">開始日時</label><input id="gameStart" class="field" type="datetime-local"><button id="saveGameAdmin" class="btn" style="width:100%;margin-top:8px">試合保存</button>
  </div></details>`;
}
function render(){
  const body=view==="games"?gamesView():view==="series"?seriesView():view==="rank"?rankView():view==="pre"?preView():adminView();
  app.innerHTML=shell(body);
  document.getElementById("logout").onclick=async()=>{try{await api("logout")}catch{}logoutLocal()};
  document.querySelectorAll("[data-view]").forEach(b=>b.onclick=()=>{view=b.dataset.view;render()});
  wireActions();
}
function num(id){return Number(document.getElementById(id).value)}
function val(id){return document.getElementById(id).value.trim()}
async function mutate(action,payload,confirmText){
  if(confirmText&&!confirm(confirmText))return;
  try{setBusy(true);state=await api(action,payload);render()}catch(e){alert(errorText(e));setBusy(false)}
}
function wireActions(){
  document.querySelectorAll("[data-save-game]").forEach(b=>b.onclick=()=>{const id=b.dataset.saveGame;mutate("saveGamePrediction",{gameId:id,awayScore:num("aw_"+id),homeScore:num("ho_"+id),stake:num("st_"+id),boost:document.getElementById("bo_"+id).checked})});
  document.querySelectorAll("[data-save-series]").forEach(b=>b.onclick=()=>{const id=b.dataset.saveSeries;mutate("saveSeriesPrediction",{seriesId:id,winnerTeam:val("sw_"+id),loserWins:num("sl_"+id),upset:document.getElementById("su_"+id).checked})});
  const pre=document.getElementById("savePre");if(pre)pre.onclick=()=>mutate("savePrePrediction",{alChampion:val("preAL"),nlChampion:val("preNL"),wsChampion:val("preWS"),wsLoserWins:num("preLW")});
  if(state.actor.role!=="admin")return;
  document.getElementById("saveNames").onclick=()=>mutate("adminSetPlayers",{names:state.players.map(p=>val("nm_"+p.id))},"5名の表示名を変更します。よろしいですか？");
  document.getElementById("savePin").onclick=()=>mutate("adminSetPin",{playerId:val("pinPlayer"),pin:val("newPin")},"PINを変更すると対象ユーザーは再ログインが必要です。続行しますか？");
  document.querySelectorAll("[data-result]").forEach(b=>b.onclick=()=>{const id=b.dataset.result;mutate("adminSetGameResult",{gameId:id,awayScore:num("ra_"+id),homeScore:num("rh_"+id)},"この試合をFINALとして確定し、自動採点します。よろしいですか？")});
  document.querySelectorAll("[data-round]").forEach(b=>b.onclick=()=>mutate("adminSetRoundClosed",{round:b.dataset.round,closed:b.dataset.closed!=="true"},b.dataset.closed==="true"?"ラウンドを再開しますか？":"ラウンドをCLOSEします。未使用最低枠が失効します。よろしいですか？"));
  document.getElementById("savePreLock").onclick=()=>mutate("adminSetPreLock",{preLockAt:new Date(document.getElementById("preLock").value).toISOString()},"大会前予想の締切日時を変更しますか？");
  document.getElementById("savePreResult").onclick=()=>mutate("adminSetPreResult",{alChampion:val("actualAL"),nlChampion:val("actualNL"),wsChampion:val("actualWS"),wsLoserWins:num("actualLW")},"大会前予想の最終結果を確定して採点します。よろしいですか？");
  document.getElementById("saveSeriesAdmin").onclick=()=>mutate("adminUpsertSeries",{id:val("seriesId"),code:val("seriesCode"),league:val("seriesLeague"),round:val("seriesRound"),teamA:val("teamA"),teamB:val("teamB"),seedA:val("seedA")||null,seedB:val("seedB")||null,startsAt:new Date(document.getElementById("seriesStart").value).toISOString(),status:"scheduled"},"シリーズ情報を保存しますか？");
  document.getElementById("saveGameAdmin").onclick=()=>mutate("adminUpsertGame",{id:val("gameId"),seriesId:val("gameSeriesId"),gameNo:num("gameNo"),awayTeam:val("gameAway"),homeTeam:val("gameHome"),startsAt:new Date(document.getElementById("gameStart").value).toISOString(),status:"scheduled"},"試合情報を保存しますか？");
}
if(token)refresh();else renderLogin();
setInterval(()=>{if(token&&!busy)refresh()},30000);
