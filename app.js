const API="https://lidgvyhsytwwfndsmeic.supabase.co/functions/v1/mlb-prediction";
const app=document.getElementById("app");
let token=localStorage.getItem("mlb_token")||"";
let state=null,view="home",role="player",actorId="p1",busy=false;

const TEAM_NAMES={
  NYY:"ヤンキース",BOS:"レッドソックス",TOR:"ブルージェイズ",BAL:"オリオールズ",TB:"レイズ",
  CLE:"ガーディアンズ",DET:"タイガース",MIN:"ツインズ",CWS:"ホワイトソックス",KC:"ロイヤルズ",
  HOU:"アストロズ",TEX:"レンジャーズ",SEA:"マリナーズ",LAA:"エンゼルス",OAK:"アスレチックス",ATH:"アスレチックス",
  ATL:"ブレーブス",PHI:"フィリーズ",NYM:"メッツ",MIA:"マーリンズ",WSH:"ナショナルズ",
  MIL:"ブルワーズ",CHC:"カブス",STL:"カージナルス",CIN:"レッズ",PIT:"パイレーツ",
  LAD:"ドジャース",SD:"パドレス",SF:"ジャイアンツ",ARI:"ダイヤモンドバックス",COL:"ロッキーズ"
};
const ROUND_NAMES={WCS:"ワイルドカード",DS:"地区シリーズ",LCS:"リーグ優勝決定シリーズ",WS:"ワールドシリーズ"};
const esc=v=>String(v??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const teamName=v=>TEAM_NAMES[String(v||"").toUpperCase()]||String(v||"");
const teamCode=v=>String(v||"").toUpperCase();
const roundName=v=>ROUND_NAMES[v]||String(v||"");
const jst=d=>new Date(d).toLocaleString("ja-JP",{timeZone:"Asia/Tokyo",month:"numeric",day:"numeric",weekday:"short",hour:"2-digit",minute:"2-digit"});
const localInput=d=>{const dt=new Date(d);const j=new Date(dt.toLocaleString("en-US",{timeZone:"Asia/Tokyo"}));return new Date(j.getTime()-j.getTimezoneOffset()*60000).toISOString().slice(0,16)};
const isLocked=(d,status="scheduled")=>new Date(d)<=new Date(state?.serverTime||Date.now())||status!=="scheduled";
function setBusy(v){busy=v;const e=document.getElementById("busy");if(e)e.classList.toggle("hidden",!v)}
async function api(action,payload={}){
  const res=await fetch(API,{method:"POST",headers:{"content-type":"application/json","x-session-token":token},body:JSON.stringify({action,payload})});
  let body={};try{body=await res.json()}catch{}
  if(!res.ok)throw new Error(body.error||"通信エラー");
  return body;
}
function errorText(err){const t=String(err?.message||err||"エラーが発生しました");if(t==="unauthorized")return"ログインの有効期限が切れました。再度ログインしてください。";return t}
function logoutLocal(){token="";state=null;localStorage.removeItem("mlb_token");renderLogin()}

function renderLogin(){
  app.innerHTML=`
  <section class="login-shell">
    <div class="login-wrap">
      <div class="brand">
        <div class="brand-badge"><span class="brand-mark">⚾</span> 2026 POSTSEASON</div>
        <h1><span>MLB</span>ポストシーズン<br>予想ゲーム</h1>
        <p>5人対戦プライベートゲーム</p>
      </div>
      <div class="login-card">
        <div class="role-switch">
          <button id="rolePlayer" class="btn">👤 プレイヤー</button>
          <button id="roleAdmin" class="btn secondary">⚙ 管理者</button>
        </div>
        <div id="playerSelectTitle" class="pin-hint">プレイヤーを選択してください</div>
        <div id="playerGrid" class="player-grid">
          ${[1,2,3,4,5].map(n=>`<button class="btn ${n===1?"active":"secondary"}" data-player="p${n}">P${n}</button>`).join("")}
        </div>
        <div class="pin-hint">4桁のPINを入力</div>
        <input id="pin" class="field" style="margin-top:7px;text-align:center;font-size:22px;letter-spacing:.35em" maxlength="4" inputmode="numeric" autocomplete="one-time-code" placeholder="••••">
        <button id="loginBtn" class="btn login-submit">ログイン →</button>
        <div id="loginError" class="error"></div>
      </div>
    </div>
  </section>`;
  const pg=document.getElementById("playerGrid"),pt=document.getElementById("playerSelectTitle"),rp=document.getElementById("rolePlayer"),ra=document.getElementById("roleAdmin");
  rp.onclick=()=>{role="player";actorId="p1";pg.classList.remove("hidden");pt.classList.remove("hidden");rp.className="btn";ra.className="btn secondary";[...document.querySelectorAll("[data-player]")].forEach((b,i)=>b.className="btn "+(i?"secondary":"active"))};
  ra.onclick=()=>{role="admin";actorId="admin";pg.classList.add("hidden");pt.classList.add("hidden");ra.className="btn";rp.className="btn secondary"};
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
async function refresh(){try{state=await api("state");render()}catch(e){logoutLocal()}}

function shell(body){
  const nav=[["home","ホーム"],["games","試合"],["series","シリーズ"],["rank","順位"],["pre","大会前"],["admin","管理"]].filter(x=>x[0]!=="admin"||state.actor.role==="admin");
  return `<div class="shell">
    <header class="topbar">
      <div class="topbar-row">
        <div class="header-brand"><div class="header-mark">⚾</div><div><div class="eyebrow">MLB ポストシーズン予想ゲーム</div><h2>${esc(state.actor.display_name)}</h2></div></div>
        <button id="logout" class="btn ghost small">ログアウト</button>
      </div>
    </header>
    <main class="content">${body}</main>
    <nav class="nav">${nav.map(([k,l])=>`<button data-view="${k}" class="${view===k?"active":""}">${l}</button>`).join("")}</nav>
    <div id="busy" class="loading-overlay hidden"><div class="loading-box"><div class="spinner"></div><div class="muted" style="margin-top:8px">更新中...</div></div></div>
  </div>`;
}
function viewTitle(title,sub){return `<section class="view-title"><h1>${title}</h1><p>${sub}</p></section>`}
function guideSteps(items){return `<div class="guide-steps">${items.map((x,i)=>`<div class="guide-step"><span>${i+1}</span><b>${x}</b></div>`).join("")}</div>`}

function homeView(){
  const now=new Date(state.serverTime||Date.now());
  const mineGame=state.gamePredictions.filter(x=>x.actor_id===state.actor.id);
  const mineSeries=state.seriesPredictions.filter(x=>x.actor_id===state.actor.id);
  const minePre=state.prePredictions.find(x=>x.actor_id===state.actor.id);
  const preOpen=state.config.pre_lock_at&&new Date(state.config.pre_lock_at)>now;
  const openSeries=state.series.filter(s=>new Date(s.starts_at)>now&&s.status==="scheduled");
  const openGames=state.games.filter(g=>new Date(g.starts_at)>now&&g.status==="scheduled");
  const undoneSeries=openSeries.filter(s=>!mineSeries.some(p=>p.series_id===s.id));
  const undoneGames=openGames.filter(g=>!mineGame.some(p=>p.game_id===g.id));
  let next={view:"rank",icon:"🏆",label:"予想入力は完了",title:"順位表を確認しよう",desc:"結果が確定すると自動でポイントと順位が更新されます。",button:"順位表を見る"};
  if(state.actor.role==="admin"){
    next={view:"admin",icon:"⚙",label:"管理者メニュー",title:"試合結果と日程を管理",desc:"結果確定・ラウンド管理・次ラウンドの試合登録を行えます。",button:"管理画面を開く"};
  }else if(preOpen&&!minePre){
    next={view:"pre",icon:"①",label:"最初にやること",title:"大会前予想を登録しよう",desc:"ア・リーグ、ナ・リーグ、ワールドシリーズの優勝予想を登録します。",button:"大会前予想へ"};
  }else if(undoneSeries.length){
    const s=undoneSeries[0];
    next={view:"series",icon:"②",label:"次にやること",title:"シリーズ予想を入力しよう",desc:`${teamName(s.team_a)} vs ${teamName(s.team_b)} の勝者と最終成績を予想します。`,button:"シリーズ予想へ"};
  }else if(undoneGames.length){
    const g=undoneGames[0];
    next={view:"games",icon:"③",label:"次にやること",title:"試合予想を入力しよう",desc:`${teamName(g.away_team)} vs ${teamName(g.home_team)} のスコアと配分ポイントを入力します。`,button:"試合予想へ"};
  }
  const seriesDone=openSeries.length-undoneSeries.length;
  const gameDone=openGames.length-undoneGames.length;
  const rank=state.ranking.findIndex(x=>x.player.id===state.actor.id);
  return viewTitle("ホーム",state.actor.role==="admin"?"運営状況を確認して管理メニューへ進みます。":"ここを見れば、次に何をすればよいか分かります。")+
  `<section class="next-card">
      <div class="next-badge">${next.icon} ${next.label}</div>
      <h2>${esc(next.title)}</h2>
      <p>${esc(next.desc)}</p>
      <button class="btn danger next-button" data-go="${next.view}">${next.button} →</button>
    </section>`+
  (state.actor.role==="player"?`
    <section class="card">
      <div class="section-title"><h3>あなたの進行状況</h3><span class="pill">残り ${state.budget?.available??"-"}P</span></div>
      <div class="progress-grid">
        <div class="progress-item ${minePre?"done":""}"><span>大会前予想</span><b>${minePre?"完了":"未入力"}</b></div>
        <div class="progress-item ${openSeries.length&&seriesDone===openSeries.length?"done":""}"><span>シリーズ予想</span><b>${seriesDone}/${openSeries.length}</b></div>
        <div class="progress-item ${openGames.length&&gameDone===openGames.length?"done":""}"><span>試合予想</span><b>${gameDone}/${openGames.length}</b></div>
        <div class="progress-item"><span>現在順位</span><b>${rank>=0?rank+1:"-" }位</b></div>
      </div>
    </section>
    <section class="card">
      <h3>遊び方はこの3ステップ</h3>
      <div class="flow-list">
        <div class="flow-item"><span>1</span><div><b>大会前・シリーズを予想</b><small>締切前に勝者やシリーズ成績を登録</small></div></div>
        <div class="flow-item"><span>2</span><div><b>各試合のスコアとポイントを予想</b><small>1試合1〜10P。BOOSTは各ラウンド1回</small></div></div>
        <div class="flow-item"><span>3</span><div><b>結果後に順位表を確認</b><small>採点は自動。獲得ポイントで5人の順位が決定</small></div></div>
      </div>
    </section>`:"");
}

function budgetCard(){
  if(!state.budget)return"";
  const b=state.budget;
  return `<section class="card glow">
    <div class="budget-head"><div><div class="muted">👑 残り使用可能ポイント</div><div class="tiny">150Pを各ラウンドへ戦略的に配分</div></div><div class="metric">${b.available}<span style="font-size:15px;color:#9eb1c3">P</span></div></div>
    <div class="budget-row">
      <div class="budget-box"><span>自由枠</span><b>${b.freeRemaining}</b><span>/70</span></div>
      <div class="budget-box"><span>ワイルドカード</span><b>${b.spentByRound.WCS}</b><span>/最低20</span></div>
      <div class="budget-box"><span>地区シリーズ</span><b>${b.spentByRound.DS}</b><span>/最低30</span></div>
      <div class="budget-box"><span>リーグ優勝決定</span><b>${b.spentByRound.LCS}</b><span>/最低20</span></div>
      <div class="budget-box"><span>ワールドシリーズ</span><b>${b.spentByRound.WS}</b><span>/最低10</span></div>
    </div>
  </section>`;
}

function matchupBlock(away,home){
  return `<div class="matchup">
    <div class="team-panel away"><div class="team-code">${esc(teamCode(away))}</div><div class="team-name">${esc(teamName(away))}</div></div>
    <div class="vs">VS</div>
    <div class="team-panel home"><div class="team-code">${esc(teamCode(home))}</div><div class="team-name">${esc(teamName(home))}</div></div>
  </div>`;
}

function gamesView(){
  let out=viewTitle("試合予想","各試合のスコアと使うポイントを決めます。")+guideSteps(["予想スコアを入力","1〜10Pを配分","BOOSTを選んで保存"])+budgetCard();
  for(const g of state.games){
    const s=state.series.find(x=>x.id===g.series_id),p=state.gamePredictions.find(x=>x.game_id===g.id&&x.actor_id===state.actor.id),lock=isLocked(g.starts_at,g.status);
    const pill=g.status==="final"?'<span class="pill final">試合終了</span>':lock?'<span class="pill lock">締切</span>':'<span class="pill live">受付中</span>';
    out+=`<section class="card">
      <div class="status-line"><div class="muted">${esc(roundName(s?.round))} 第${g.game_no}戦 · ${jst(g.starts_at)}</div>${pill}</div>
      ${matchupBlock(g.away_team,g.home_team)}
      ${g.status==="final"?`<div class="notice" style="text-align:center;font-weight:900">最終スコア　${esc(teamName(g.away_team))} ${g.away_score} - ${g.home_score} ${esc(teamName(g.home_team))}</div>`:""}
      ${state.actor.role==="player"?`
      <div class="score-grid">
        <div><div class="team">${esc(teamName(g.away_team))}</div><input id="aw_${g.id}" class="field" type="number" min="0" max="30" value="${p?.away_score??""}" ${lock?"disabled":""}></div>
        <div><label class="label" style="text-align:center">配分P</label><input id="st_${g.id}" class="field" type="number" min="1" max="10" value="${p?.stake??1}" ${lock?"disabled":""}></div>
        <div><div class="team">${esc(teamName(g.home_team))}</div><input id="ho_${g.id}" class="field" type="number" min="0" max="30" value="${p?.home_score??""}" ${lock?"disabled":""}></div>
      </div>
      <div class="boost-row"><label class="boost"><input id="bo_${g.id}" type="checkbox" ${p?.boost?"checked":""} ${lock?"disabled":""}> BOOSTを使う</label><span class="tiny">各ラウンド1回のみ</span></div>
      ${lock?"":`<button class="btn danger" style="width:100%" data-save-game="${g.id}">✓ 予想を保存</button>`}
      ${p?`<div class="notice" style="margin-top:8px">保存済み：${p.away_score}-${p.home_score} ／ ${p.stake}P${p.boost?" ／ BOOST":""}</div>`:""}
      `:""}
    </section>`;
  }
  return out;
}

function seriesView(){
  return viewTitle("シリーズ予想","第1戦の開始前に、シリーズ全体の結果を予想します。")+guideSteps(["勝者を選ぶ","最終成績を選ぶ","必要ならアップセットを選んで保存"])+
  state.series.map(s=>{
    const p=state.seriesPredictions.find(x=>x.series_id===s.id&&x.actor_id===state.actor.id),lock=isLocked(s.starts_at,s.status),need=s.round==="WCS"?2:s.round==="DS"?3:4;
    return `<section class="card"><div class="status-line"><div class="muted">${esc(roundName(s.round))} · 締切 ${jst(s.starts_at)}</div>${lock?'<span class="pill lock">締切</span>':'<span class="pill live">受付中</span>'}</div>
      ${matchupBlock(s.team_a,s.team_b)}
      ${s.status==="final"?`<div class="notice">${esc(teamName(s.winner_team))} 勝利 · ${s.wins_a}-${s.wins_b}</div>`:""}
      ${state.actor.role==="player"?`
        <label class="label">シリーズ勝者</label><select id="sw_${s.id}" class="field" ${lock?"disabled":""}><option value="${esc(s.team_a)}" ${p?.winner_team===s.team_a?"selected":""}>${esc(teamName(s.team_a))}</option><option value="${esc(s.team_b)}" ${p?.winner_team===s.team_b?"selected":""}>${esc(teamName(s.team_b))}</option></select>
        <label class="label">シリーズ最終成績</label><select id="sl_${s.id}" class="field" ${lock?"disabled":""}>${Array.from({length:need},(_,n)=>`<option value="${n}" ${+p?.loser_wins===n?"selected":""}>${need}-${n}</option>`).join("")}</select>
        <div class="boost-row"><label><input id="su_${s.id}" type="checkbox" ${p?.upset?"checked":""} ${lock?"disabled":""}> アップセット予想</label><span class="tiny">下位シード勝利で×1.5</span></div>
        ${lock?"":`<button class="btn danger" style="width:100%" data-save-series="${s.id}">✓ シリーズ予想を保存</button>`}
      `:""}
    </section>`
  }).join("");
}

function rankView(){
  return viewTitle("🏆 順位表","試合結果が確定すると自動で採点され、順位が更新されます。")+
  `<section class="card glow"><div class="rank-list">${state.ranking.map((x,i)=>`
    <div class="rank-row rank-${i+1}">
      <div class="rank-no">${i+1}</div>
      <div><b>${esc(x.player.display_name)}</b><div class="rank-meta"><span>試合 ${x.game}</span><span>シリーズ ${x.series}</span><span>大会前 ${x.pre}</span><span>残り ${x.remaining}P</span></div></div>
      <div class="rank-score">${x.total}P</div>
    </div>`).join("")}</div></section>`;
}

function preView(){
  const p=state.prePredictions.find(x=>x.actor_id===state.actor.id),lock=state.config.pre_lock_at&&new Date(state.config.pre_lock_at)<=new Date(state.serverTime);
  return viewTitle("大会前予想","ポストシーズン開始前に優勝チームを予想します。")+guideSteps(["AL・NL優勝を入力","WS優勝を入力","WS最終成績を選んで保存"])+
  `<section class="card glow"><div class="section-title"><h3>優勝予想</h3>${lock?'<span class="pill lock">締切</span>':'<span class="pill live">受付中</span>'}</div>
  <div class="muted">締切：${jst(state.config.pre_lock_at)}</div>
  ${state.actor.role==="player"?`
  <label class="label">ア・リーグ優勝</label><input id="preAL" class="field" value="${esc(p?.al_champion||"")}" ${lock?"disabled":""} placeholder="例：NYY">
  <label class="label">ナ・リーグ優勝</label><input id="preNL" class="field" value="${esc(p?.nl_champion||"")}" ${lock?"disabled":""} placeholder="例：LAD">
  <label class="label">ワールドシリーズ優勝</label><input id="preWS" class="field" value="${esc(p?.ws_champion||"")}" ${lock?"disabled":""} placeholder="AL/NL優勝予想のどちらか">
  <label class="label">ワールドシリーズ最終成績</label><select id="preLW" class="field" ${lock?"disabled":""}>${[0,1,2,3].map(n=>`<option value="${n}" ${+p?.ws_loser_wins===n?"selected":""}>4-${n}</option>`).join("")}</select>
  ${lock?"":'<button id="savePre" class="btn danger" style="width:100%;margin-top:10px">✓ 大会前予想を保存</button>'}
  `:''}</section>`;
}

function adminView(){
  if(state.actor.role!=="admin")return "";
  const names=state.players.map(p=>`<label class="label">${esc(p.id.toUpperCase())}</label><input class="field" id="nm_${p.id}" value="${esc(p.display_name)}">`).join("");
  const gameRows=state.games.map(g=>`<div class="admin-block"><div class="muted">${esc(teamName(g.away_team))} @ ${esc(teamName(g.home_team))} · ${jst(g.starts_at)}</div><div class="three-col" style="margin-top:7px"><input class="field" id="ra_${g.id}" type="number" placeholder="アウェー" value="${g.away_score??""}"><input class="field" id="rh_${g.id}" type="number" placeholder="ホーム" value="${g.home_score??""}"><button class="btn" data-result="${g.id}">試合結果を確定</button></div></div>`).join("");
  return viewTitle("管理者メニュー","プレイヤー設定、試合結果、ラウンド管理、後続カードの登録を行います。")+`
  <details class="card" open><summary>プレイヤー設定</summary><div class="admin-block">${names}<button id="saveNames" class="btn" style="width:100%;margin-top:10px">名前を保存</button></div>
    <div class="admin-block"><h3>PIN変更</h3><div class="two-col mobile-stack"><select id="pinPlayer" class="field">${state.players.map(p=>`<option value="${p.id}">${esc(p.display_name)}</option>`).join("")}<option value="admin">管理者</option></select><input id="newPin" class="field" maxlength="4" inputmode="numeric" placeholder="新しい4桁PIN"></div><button id="savePin" class="btn danger" style="width:100%;margin-top:8px">PINを変更</button></div>
  </details>
  <details class="card"><summary>試合結果入力</summary>${gameRows}</details>
  <details class="card"><summary>ラウンド管理</summary><div class="admin-block">${state.rounds.map(r=>`<button class="btn ${r.closed?"secondary":""}" style="width:100%;margin:4px 0" data-round="${r.round}" data-closed="${r.closed}">${roundName(r.round)} ${r.closed?"再開":"終了"}</button>`).join("")}</div></details>
  <details class="card"><summary>大会前予想管理</summary><div class="admin-block"><label class="label">締切日時</label><input id="preLock" class="field" type="datetime-local" value="${localInput(state.config.pre_lock_at)}"><button id="savePreLock" class="btn" style="width:100%;margin-top:8px">締切を更新</button></div>
    <div class="admin-block"><label class="label">ア・リーグ優勝</label><input id="actualAL" class="field" placeholder="例：NYY"><label class="label">ナ・リーグ優勝</label><input id="actualNL" class="field" placeholder="例：LAD"><label class="label">ワールドシリーズ優勝</label><input id="actualWS" class="field" placeholder="例：LAD"><label class="label">WS最終成績</label><select id="actualLW" class="field">${[0,1,2,3].map(n=>`<option value="${n}">4-${n}</option>`).join("")}</select><button id="savePreResult" class="btn danger" style="width:100%;margin-top:8px">最終結果を確定・採点</button></div>
  </details>
  <details class="card"><summary>シリーズ / 試合登録</summary><div class="admin-block">
    <div class="notice">地区シリーズ以降や開始時刻変更用です。既存IDを入力すると編集、空欄なら新規登録です。</div>
    <label class="label">シリーズID（編集時のみ）</label><input id="seriesId" class="field">
    <div class="two-col"><div><label class="label">シリーズコード</label><input id="seriesCode" class="field"></div><div><label class="label">リーグ</label><select id="seriesLeague" class="field"><option value="AL">ア・リーグ</option><option value="NL">ナ・リーグ</option></select></div></div>
    <label class="label">ラウンド</label><select id="seriesRound" class="field"><option value="WCS">ワイルドカード</option><option value="DS">地区シリーズ</option><option value="LCS">リーグ優勝決定シリーズ</option><option value="WS">ワールドシリーズ</option></select>
    <div class="two-col"><div><label class="label">チームA</label><input id="teamA" class="field" placeholder="例：NYY"></div><div><label class="label">チームB</label><input id="teamB" class="field" placeholder="例：BOS"></div></div>
    <div class="two-col"><div><label class="label">シードA</label><input id="seedA" class="field" type="number"></div><div><label class="label">シードB</label><input id="seedB" class="field" type="number"></div></div>
    <label class="label">開始日時</label><input id="seriesStart" class="field" type="datetime-local"><button id="saveSeriesAdmin" class="btn" style="width:100%;margin-top:8px">シリーズを保存</button>
    <div class="sep"></div>
    <label class="label">試合ID（編集時のみ）</label><input id="gameId" class="field"><label class="label">シリーズID</label><input id="gameSeriesId" class="field">
    <div class="three-col"><div><label class="label">第何戦</label><input id="gameNo" class="field" type="number" min="1" max="7"></div><div><label class="label">アウェー</label><input id="gameAway" class="field"></div><div><label class="label">ホーム</label><input id="gameHome" class="field"></div></div>
    <label class="label">開始日時</label><input id="gameStart" class="field" type="datetime-local"><button id="saveGameAdmin" class="btn" style="width:100%;margin-top:8px">試合を保存</button>
  </div></details>`;
}

function render(){
  const body=view==="home"?homeView():view==="games"?gamesView():view==="series"?seriesView():view==="rank"?rankView():view==="pre"?preView():adminView();
  app.innerHTML=shell(body);
  document.getElementById("logout").onclick=async()=>{try{await api("logout")}catch{}logoutLocal()};
  document.querySelectorAll("[data-view]").forEach(b=>b.onclick=()=>{view=b.dataset.view;render()});
  document.querySelectorAll("[data-go]").forEach(b=>b.onclick=()=>{view=b.dataset.go;render()});
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
  document.querySelectorAll("[data-result]").forEach(b=>b.onclick=()=>{const id=b.dataset.result;mutate("adminSetGameResult",{gameId:id,awayScore:num("ra_"+id),homeScore:num("rh_"+id)},"この試合結果を確定し、自動採点します。よろしいですか？")});
  document.querySelectorAll("[data-round]").forEach(b=>b.onclick=()=>mutate("adminSetRoundClosed",{round:b.dataset.round,closed:b.dataset.closed!=="true"},b.dataset.closed==="true"?"このラウンドを再開しますか？":"ラウンドを終了します。未使用最低枠は失効します。よろしいですか？"));
  document.getElementById("savePreLock").onclick=()=>mutate("adminSetPreLock",{preLockAt:new Date(document.getElementById("preLock").value).toISOString()},"大会前予想の締切日時を変更しますか？");
  document.getElementById("savePreResult").onclick=()=>mutate("adminSetPreResult",{alChampion:val("actualAL"),nlChampion:val("actualNL"),wsChampion:val("actualWS"),wsLoserWins:num("actualLW")},"大会前予想の最終結果を確定して採点します。よろしいですか？");
  document.getElementById("saveSeriesAdmin").onclick=()=>mutate("adminUpsertSeries",{id:val("seriesId"),code:val("seriesCode"),league:val("seriesLeague"),round:val("seriesRound"),teamA:val("teamA"),teamB:val("teamB"),seedA:val("seedA")||null,seedB:val("seedB")||null,startsAt:new Date(document.getElementById("seriesStart").value).toISOString(),status:"scheduled"},"シリーズ情報を保存しますか？");
  document.getElementById("saveGameAdmin").onclick=()=>mutate("adminUpsertGame",{id:val("gameId"),seriesId:val("gameSeriesId"),gameNo:num("gameNo"),awayTeam:val("gameAway"),homeTeam:val("gameHome"),startsAt:new Date(document.getElementById("gameStart").value).toISOString(),status:"scheduled"},"試合情報を保存しますか？");
}
if(token)refresh();else renderLogin();
setInterval(()=>{if(token&&!busy)refresh()},30000);
