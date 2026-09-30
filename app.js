const API="https://lidgvyhsytwwfndsmeic.supabase.co/functions/v1/mlb-prediction";
const app=document.getElementById("app");
let token=localStorage.getItem("mlb_token")||"";
let state=null,view="home",role="player",actorId="p1",busy=false,toastMessage="";

const TEAM_NAMES={
  NYY:"ヤンキース",BOS:"レッドソックス",TOR:"ブルージェイズ",BAL:"オリオールズ",TB:"レイズ",
  CLE:"ガーディアンズ",DET:"タイガース",MIN:"ツインズ",CWS:"ホワイトソックス",KC:"ロイヤルズ",
  HOU:"アストロズ",TEX:"レンジャーズ",SEA:"マリナーズ",LAA:"エンゼルス",OAK:"アスレチックス",ATH:"アスレチックス",
  ATL:"ブレーブス",PHI:"フィリーズ",NYM:"メッツ",MIA:"マーリンズ",WSH:"ナショナルズ",
  MIL:"ブルワーズ",CHC:"カブス",STL:"カージナルス",CIN:"レッズ",PIT:"パイレーツ",
  LAD:"ドジャース",SD:"パドレス",SF:"ジャイアンツ",ARI:"ダイヤモンドバックス",COL:"ロッキーズ"
};
const ROUND_NAMES={WCS:"ワイルドカード",DS:"地区シリーズ",LCS:"リーグ優勝決定シリーズ",WS:"ワールドシリーズ"};
const AL_TEAMS=["NYY","BOS","TOR","BAL","TB","CLE","DET","MIN","CWS","KC","HOU","TEX","SEA","LAA","ATH"];
const NL_TEAMS=["ATL","PHI","NYM","MIA","WSH","MIL","CHC","STL","CIN","PIT","LAD","SD","SF","ARI","COL"];
const ALL_TEAMS=[...AL_TEAMS,...NL_TEAMS];
const POSTSEASON_AL=["TB","CLE","HOU","NYY","BOS","CWS"];
const POSTSEASON_NL=["MIL","LAD","ATL","SD","CHC","PHI"];
const POSTSEASON_SEED={TB:1,CLE:2,HOU:3,NYY:4,BOS:5,CWS:6,MIL:1,LAD:2,ATL:3,SD:4,CHC:5,PHI:6};
const esc=v=>String(v??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const teamName=v=>TEAM_NAMES[String(v||"").toUpperCase()]||String(v||"");
const teamCode=v=>String(v||"").toUpperCase();
const roundName=v=>ROUND_NAMES[v]||String(v||"");
const teamOptions=(codes,selected="")=>'<option value="">選択してください</option>'+codes.map(c=>`<option value="${c}" ${selected===c?"selected":""}>${teamName(c)}</option>`).join("");
function syncPreWsChoices(){
  const al=document.getElementById("preAL"),nl=document.getElementById("preNL"),ws=document.getElementById("preWS");
  if(!al||!nl||!ws)return;
  const current=ws.value,choices=[al.value,nl.value].filter(Boolean);
  ws.innerHTML=teamOptions(choices,choices.includes(current)?current:(choices[0]||""));
}
const jst=d=>new Date(d).toLocaleString("ja-JP",{timeZone:"Asia/Tokyo",month:"numeric",day:"numeric",weekday:"short",hour:"2-digit",minute:"2-digit"});
const localInput=d=>{const dt=new Date(d);const j=new Date(dt.toLocaleString("en-US",{timeZone:"Asia/Tokyo"}));return new Date(j.getTime()-j.getTimezoneOffset()*60000).toISOString().slice(0,16)};
const isLocked=(d,status="scheduled")=>new Date(d)<=new Date(state?.serverTime||Date.now())||status!=="scheduled";
function timingMeta(d,status="scheduled"){
  const target=new Date(d),now=new Date(state?.serverTime||Date.now()),ms=target-now;
  if(status==="cancelled")return{cls:"time-cancelled",countdown:"開催なし",locked:true};
  if(status==="final")return{cls:"time-closed",countdown:"試合終了",locked:true};
  if(status!=="scheduled"||ms<=0)return{cls:"time-closed",countdown:"締切済み",locked:true};
  const total=Math.max(0,Math.floor(ms/60000)),days=Math.floor(total/1440),hours=Math.floor((total%1440)/60),mins=total%60;
  const countdown=days>0?`あと${days}日${hours}時間`:hours>0?`あと${hours}時間${mins}分`:`あと${mins}分`;
  return{cls:total<=60?"time-urgent":total<=360?"time-soon":"time-open",countdown,locked:false};
}
function gameTimingPanel(d,status="scheduled"){
  const t=timingMeta(d,status);
  return `<div class="timing-panel ${t.cls}"><div class="timing-primary"><span>予想締切</span><b>${jst(d)}</b><small>（試合開始時刻と同時）</small></div><div class="timing-countdown">${t.countdown}</div></div>`;
}
function seriesTimingPanel(d,status="scheduled"){
  const t=timingMeta(d,status);
  return `<div class="timing-panel series-timing ${t.cls}"><div class="timing-primary"><span>シリーズ予想締切</span><b>${jst(d)}</b><small>（第1戦開始時刻と同時）</small></div><div class="timing-countdown">${t.countdown}</div></div>`;
}
function setBusy(v){busy=v;const e=document.getElementById("busy");if(e)e.classList.toggle("hidden",!v)}
async function api(action,payload={}){
  const res=await fetch(API,{method:"POST",headers:{"content-type":"application/json","x-session-token":token},body:JSON.stringify({action,payload})});
  let body={};try{body=await res.json()}catch{}
  if(!res.ok){
    const err=new Error(body.error||"通信エラー");
    err.status=res.status;
    throw err;
  }
  return body;
}
function errorText(err){const t=String(err?.message||err||"エラーが発生しました");if(t==="unauthorized")return"ログインの有効期限が切れました。再度ログインしてください。";return t}
function logoutLocal(){token="";state=null;localStorage.removeItem("mlb_token");renderLogin()}

function renderLogin(){
  app.innerHTML=`
  <section class="login-shell">
    <div class="login-wrap">
      <div class="brand">
        <div class="brand-badge"><span class="brand-mark">MLB</span> 2026 POSTSEASON</div>
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
async function refresh(){
  try{
    state=await api("state");
  }catch(e){
    if(e?.status===401){logoutLocal();return}
    console.error("State refresh failed",e);
    const er=document.getElementById("loginError");
    if(er)er.textContent=errorText(e);
    return;
  }
  try{
    render();
  }catch(e){
    console.error("Render failed",e);
    app.innerHTML=`<section class="login-shell"><div class="login-wrap"><div class="login-card"><h2>画面表示でエラーが発生しました</h2><p class="pin-hint">ログイン状態は保持されています。ページを再読み込みしてください。</p><button id="retryRender" class="btn login-submit">再読み込み</button><div class="error">${esc(e?.message||"表示エラー")}</div></div></div></section>`;
    document.getElementById("retryRender").onclick=()=>location.reload();
  }
}

function renderSetup(){
  app.innerHTML=`
  <section class="setup-shell">
    <div class="setup-wrap">
      <div class="setup-brand">
        <div class="brand-badge"><span class="brand-mark">MLB</span> FIRST SETUP</div>
        <h1>初回設定</h1>
        <p>${esc(state.actor.id.toUpperCase())} の名前とPINを登録してください。</p>
      </div>
      <div class="setup-card">
        <div class="setup-step-label">STEP 1</div>
        <label class="label">表示する名前</label>
        <input id="setupName" class="field setup-field" maxlength="40" autocomplete="name" placeholder="あなたの名前">
        <div class="setup-hint">順位表や予想画面に表示されます。</div>

        <div class="setup-step-label">STEP 2</div>
        <label class="label">新しい4桁PIN</label>
        <input id="setupPin" class="field setup-field pin-input" maxlength="4" inputmode="numeric" autocomplete="new-password" placeholder="••••">
        <div class="setup-hint">今回ログインした仮PINとは違う番号を設定してください。</div>

        <label class="label">新しいPINをもう一度</label>
        <input id="setupPinConfirm" class="field setup-field pin-input" maxlength="4" inputmode="numeric" autocomplete="new-password" placeholder="••••">

        <div id="setupError" class="error"></div>
        <button id="setupSave" class="btn danger setup-save">この内容でゲームを開始 →</button>
        <button id="setupLogout" class="btn ghost setup-logout">ログアウト</button>
      </div>
    </div>
  </section>`;

  document.getElementById("setupLogout").onclick=async()=>{
    try{await api("logout")}catch{}
    logoutLocal();
  };
  document.getElementById("setupSave").onclick=async()=>{
    const name=document.getElementById("setupName").value.trim();
    const pin=document.getElementById("setupPin").value.trim();
    const confirmPin=document.getElementById("setupPinConfirm").value.trim();
    const er=document.getElementById("setupError"),btn=document.getElementById("setupSave");
    er.textContent="";
    if(!name){er.textContent="名前を入力してください。";return}
    if(name.length>40){er.textContent="名前は40文字以内で入力してください。";return}
    if(!/^\d{4}$/.test(pin)){er.textContent="新しいPINは4桁の数字で入力してください。";return}
    if(pin!==confirmPin){er.textContent="確認用PINが一致していません。";return}
    try{
      btn.disabled=true;btn.textContent="登録中...";
      state=await api("completeSetup",{displayName:name,pin});
      view="home";
      render();
    }catch(e){
      er.textContent=errorText(e);
      btn.disabled=false;btn.textContent="この内容でゲームを開始 →";
    }
  };
}


function uiIcon(name){
  const common='viewBox="0 0 24 24" aria-hidden="true"';
  const icons={
    home:`<svg ${common}><path d="M3 11.2 12 4l9 7.2v8.3a1.5 1.5 0 0 1-1.5 1.5h-5v-6h-5v6h-5A1.5 1.5 0 0 1 3 19.5z"/></svg>`,
    games:`<svg ${common}><circle cx="12" cy="12" r="8.2"/><path d="M6.7 7.5c2.1 1.4 3.2 3.1 3.3 5.2M17.3 7.5c-2.1 1.4-3.2 3.1-3.3 5.2M6.8 16.3c2-1.4 3.1-3 3.2-5.1M17.2 16.3c-2-1.4-3.1-3-3.2-5.1"/></svg>`,
    series:`<svg ${common}><path d="M12 3 21 12 12 21 3 12z"/><path d="M12 7v10M7 12h10"/></svg>`,
    rank:`<svg ${common}><path d="M8 4h8v4a4 4 0 0 1-8 0z"/><path d="M8 6H5v1.5A3.5 3.5 0 0 0 8.2 11M16 6h3v1.5a3.5 3.5 0 0 1-3.2 3.5M12 12v4M9 20h6M10 16h4v4h-4z"/></svg>`,
    pre:`<svg ${common}><path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/></svg>`,
    admin:`<svg ${common}><circle cx="12" cy="12" r="3"/><path d="M19 13.5v-3l-2-.7-.8-1.9.9-1.9-2.1-2.1-1.9.9-1.9-.8-.7-2h-3l-.7 2-1.9.8-1.9-.9L.9 6l.9 1.9L1 9.8v3l2 .7.8 1.9-.9 1.9L5 19.4l1.9-.9 1.9.8.7 2h3l.7-2 1.9-.8 1.9.9 2.1-2.1-.9-1.9z"/></svg>`,
    bell:`<svg ${common}><path d="M6.5 17h11l-1.2-1.7V10a4.3 4.3 0 0 0-8.6 0v5.3z"/><path d="M10 19a2.2 2.2 0 0 0 4 0"/></svg>`
  };
  return icons[name]||"";
}
function pendingStatus(){
  if(!state||state.actor.role!=="player")return {pre:0,series:0,games:0,total:0};
  const now=new Date(state.serverTime||Date.now());
  const mineGame=state.gamePredictions.filter(x=>x.actor_id===state.actor.id);
  const mineSeries=state.seriesPredictions.filter(x=>x.actor_id===state.actor.id);
  const minePre=state.prePredictions.find(x=>x.actor_id===state.actor.id);
  const pre=state.config.pre_lock_at&&new Date(state.config.pre_lock_at)>now&&!minePre?1:0;
  const series=state.series.filter(s=>new Date(s.starts_at)>now&&s.status==="scheduled"&&!mineSeries.some(p=>p.series_id===s.id)).length;
  const games=state.games.filter(g=>new Date(g.starts_at)>now&&g.status==="scheduled"&&!mineGame.some(p=>p.game_id===g.id)).length;
  return {pre,series,games,total:pre+series+games};
}
function shell(body){
  const pending=pendingStatus();
  const nav=[["home","ホーム",0],["games","試合",pending.games],["series","シリーズ",pending.series],["rank","順位",0],["pre","大会前",pending.pre],["admin","管理",0]].filter(x=>x[0]!=="admin"||state.actor.role==="admin");
  return `<div class="shell premium-shell">
    <header class="topbar glass-topbar">
      <div class="topbar-row">
        <div class="header-brand"><div class="header-mark">MLB</div><div class="header-copy"><div class="eyebrow">POSTSEASON PREDICTION 2026</div><h2>${esc(state.actor.display_name)}</h2></div></div>
        <div class="header-actions">
          ${pending.total?`<button class="header-notify" data-go="home" aria-label="未入力の予想が${pending.total}件あります">${uiIcon("bell")}<span class="notify-label">未対応</span><strong>${pending.total}</strong></button>`:`<div class="header-clear">✓ 入力済</div>`}
          <button id="logout" class="btn ghost small">ログアウト</button>
        </div>
      </div>
    </header>
    <main class="content">${body}</main>
    <nav class="nav glass-nav">${nav.map(([k,l,n])=>`<button data-view="${k}" class="${view===k?"active":""}"><span class="nav-icon">${uiIcon(k)}</span><span class="nav-label">${l}</span>${n? `<span class="nav-badge">${n>9?"9+":n}</span>`:""}</button>`).join("")}</nav>
    ${toastMessage?`<div id="appToast" class="app-toast" role="status"><span class="toast-check">✓</span><span>${esc(toastMessage)}</span></div>`:""}
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
  let next={view:"rank",icon:"RANK",label:"予想入力は完了",title:"順位表を確認しよう",desc:"結果が確定すると自動でポイントと順位が更新されます。",button:"順位表を見る"};
  if(state.actor.role==="admin"){
    next={view:"admin",icon:"ADMIN",label:"管理者メニュー",title:"試合結果と日程を管理",desc:"結果確定・ラウンド管理・次ラウンドの試合登録を行えます。",button:"管理画面を開く"};
  }else if(preOpen&&!minePre){
    next={view:"pre",icon:"01",label:"最初にやること",title:"大会前予想を登録しよう",desc:"ア・リーグ、ナ・リーグ、ワールドシリーズの優勝予想を登録します。",button:"大会前予想へ"};
  }else if(undoneSeries.length){
    const s=undoneSeries[0];
    next={view:"series",icon:"02",label:"次にやること",title:"シリーズ予想を入力しよう",desc:`${teamName(s.team_a)} vs ${teamName(s.team_b)} の勝者と最終成績を予想します。`,button:"シリーズ予想へ"};
  }else if(undoneGames.length){
    const g=undoneGames[0];
    next={view:"games",icon:"03",label:"次にやること",title:"試合予想を入力しよう",desc:`${teamName(g.away_team)} vs ${teamName(g.home_team)} のスコアと配分ポイントを入力します。`,button:"試合予想へ"};
  }
  const seriesDone=openSeries.length-undoneSeries.length;
  const gameDone=openGames.length-undoneGames.length;
  const rank=state.ranking.findIndex(x=>x.player.id===state.actor.id);
  const pendingCount=(preOpen&&!minePre?1:0)+undoneSeries.length+undoneGames.length;
  const pendingText=pendingCount
    ? `試合 ${undoneGames.length}件 ／ シリーズ ${undoneSeries.length}件 ／ 大会前 ${preOpen&&!minePre?1:0}件`
    : "現在、未入力の予想はありません";
  return viewTitle("ホーム",state.actor.role==="admin"?"運営状況を確認して管理メニューへ進みます。":"ここを見れば、次に何をすればよいか分かります。")+
  (state.actor.role==="player"?`<div class="pending-summary ${pendingCount?"has-pending":"all-done"}"><div><span class="pending-dot"></span><b>${pendingCount?"未対応 "+pendingCount+"件":"入力完了"}</b></div><small>${pendingText}</small></div>`:"")+
  `<section class="next-card ${pendingCount?"needs-action":""}">
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
    <details class="card home-help">
      <summary>遊び方を見る</summary>
      <div class="flow-list help-flow">
        <div class="flow-item"><span>1</span><div><b>大会前・シリーズを予想</b><small>締切前に勝者やシリーズ成績を登録</small></div></div>
        <div class="flow-item"><span>2</span><div><b>各試合のスコアとポイントを予想</b><small>1試合の上限はラウンド別。BOOSTは各ラウンド1回</small></div></div>
        <div class="flow-item"><span>3</span><div><b>結果後に順位表を確認</b><small>採点は自動。獲得ポイントで5人の順位が決定</small></div></div>
      </div>
    </details>
    ${rulesBlock()}`:"");
}

function rulesBlock(){
  const c=state.config||{},rm=c.round_multiplier||{},sp=c.series_points||{},pp=c.pre_points||{},mn=c.round_min||{};
  const mult=v=>Number(v??0).toFixed(1).replace(/\.0$/,"");
  const seriesLine=(label,key)=>`<div class="rule-score-row"><span>${label}</span><b>勝者 +${sp[key]?.winner??0}P</b><em>成績完全一致 +${sp[key]?.exact??0}P</em></div>`;
  return `<details class="card rules-card">
    <summary>ポイント・BOOSTルールを見る</summary>
    <div class="rules-content">
      <section class="rule-section">
        <h4>試合予想の得点</h4>
        <div class="multiplier-grid">
          <div><span>WCS</span><b>×${mult(rm.WCS)}</b></div>
          <div><span>DS</span><b>×${mult(rm.DS)}</b></div>
          <div><span>LCS</span><b>×${mult(rm.LCS)}</b></div>
          <div><span>WS</span><b>×${mult(rm.WS)}</b></div>
        </div>
        <div class="rule-list">
          <div><b>勝敗的中</b><span>配分P × ラウンド倍率</span></div>
          <div><b>片方の得点一致</b><span>さらに 配分P ×0.5 を加算</span></div>
          <div><b>完全スコア一致</b><span>さらに 配分P を加算</span></div>
          <div><b>勝敗を外した場合</b><span>0P</span></div>
        </div>
        <div class="rule-highlight boost-rule"><strong>BOOST</strong><span>上記で獲得した合計ポイントを <b>2倍</b>。各ラウンド1回だけ使用できます。</span></div>
      </section>

      <section class="rule-section">
        <h4>シリーズ予想</h4>
        <div class="rule-score-table">
          ${seriesLine("WCS","WCS")}
          ${seriesLine("DS","DS")}
          ${seriesLine("LCS","LCS")}
          ${seriesLine("WS","WS")}
        </div>
        <div class="rule-highlight upset-rule"><strong>UPSET</strong><span>下位シードの勝利を予想し、実際に勝てばシリーズ獲得ポイントを <b>1.5倍</b>。</span></div>
      </section>

      <section class="rule-section">
        <h4>大会前予想</h4>
        <div class="pre-rule-grid">
          <div><span>AL優勝</span><b>+${pp.al??0}P</b></div>
          <div><span>NL優勝</span><b>+${pp.nl??0}P</b></div>
          <div><span>WS対戦カード一致</span><b>+${pp.matchup??0}P</b></div>
          <div><span>WS優勝</span><b>+${pp.champion??0}P</b></div>
          <div><span>WS最終成績一致</span><b>+${pp.exact??0}P</b></div>
        </div>
      </section>

      <section class="rule-section rule-budget">
        <h4>配分ポイント</h4>
        <p>初期 <b>${c.initial_points??150}P</b>。1試合の最大配分は <b>WCS 10P ／ DS 8P ／ LCS 6P ／ WS 5P</b>です。最低使用枠は WCS ${mn.WCS??20}P ／ DS ${mn.DS??30}P ／ LCS ${mn.LCS??20}P ／ WS ${mn.WS??10}P、自由枠は <b>${c.free_points??70}P</b>です。</p>
        <p>シリーズ予想・大会前予想では、この150Pは消費しません。試合予想を締切前に取り消した場合は、配分PとBOOSTが未使用へ戻ります。</p>
      </section>
    </div>
  </details>`;
}

function budgetCard(){
  if(!state.budget)return"";
  const b=state.budget;
  return `<section class="card glow">
    <div class="budget-head"><div><div class="muted budget-label">PLAYOFF BUDGET</div><div class="tiny">150Pを各ラウンドへ戦略的に配分</div></div><div class="metric">${b.available}<span style="font-size:15px;color:#9eb1c3">P</span></div></div>
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
    <div class="team-panel away"><div class="team-side">AWAY</div><div class="team-name">${esc(teamName(away))}</div><div class="team-code">${esc(teamCode(away))}</div></div>
    <div class="vs"><span>VS</span></div>
    <div class="team-panel home"><div class="team-side">HOME</div><div class="team-name">${esc(teamName(home))}</div><div class="team-code">${esc(teamCode(home))}</div></div>
  </div>`;
}

function gamesView(){
  const mine=state.gamePredictions.filter(x=>x.actor_id===state.actor.id);
  const open=state.games.filter(g=>g.status!=="cancelled"&&!isLocked(g.starts_at,g.status));
  const unpredicted=open.filter(g=>!mine.some(p=>p.game_id===g.id)).length;
  const predicted=open.length-unpredicted;
  const ordered=[...state.games].sort((a,b)=>{
    const pa=mine.some(p=>p.game_id===a.id),pb=mine.some(p=>p.game_id===b.id);
    const la=isLocked(a.starts_at,a.status),lb=isLocked(b.starts_at,b.status);
    const wa=!la&&!pa?0:!la&&pa?1:2;
    const wb=!lb&&!pb?0:!lb&&pb?1:2;
    return wa-wb||new Date(a.starts_at)-new Date(b.starts_at);
  });
  let out=viewTitle("試合予想","未予想の試合を上に表示しています。")+guideSteps(["予想スコアを入力","上限内でPを配分","BOOSTを選んで保存"])+(state.actor.role==="player"?`<div class="status-summary"><div class="status-count pending"><span>未予想</span><b>${unpredicted}</b></div><div class="status-count done"><span>予想済み</span><b>${predicted}</b></div><div class="status-count"><span>受付中</span><b>${open.length}</b></div></div>`:"")+budgetCard();
  for(const g of ordered){
    const s=state.series.find(x=>x.id===g.series_id),p=state.gamePredictions.find(x=>x.game_id===g.id&&x.actor_id===state.actor.id),lock=isLocked(g.starts_at,g.status),stakeMax=state.stakeMaxByRound?.[s?.round]??10;
    let cardState="game-neutral",pill="";
    if(g.status==="final"){cardState="game-final";pill='<span class="pill final">試合終了</span>'}
    else if(g.status==="cancelled"){cardState="game-cancelled";pill='<span class="pill cancelled">開催なし</span>'}
    else if(state.actor.role!=="player"){cardState=lock?"game-locked":"game-neutral";pill=lock?'<span class="pill lock">締切</span>':'<span class="pill live">受付中</span>'}
    else if(p&&lock){cardState="game-predicted game-locked";pill='<span class="pill predicted">✓ 予想済・締切</span>'}
    else if(p){cardState="game-predicted";pill='<span class="pill predicted">✓ 予想済</span>'}
    else if(lock){cardState="game-missed";pill='<span class="pill missed">未予想で締切</span>'}
    else{cardState="game-unpredicted";pill='<span class="pill pending">● 未予想</span>'}
    out+=`<section class="card game-card ${cardState}">
      <div class="status-line"><div class="muted">${esc(roundName(s?.round))} 第${g.game_no}戦</div>${pill}</div>
      ${gameTimingPanel(g.starts_at,g.status)}
      ${matchupBlock(g.away_team,g.home_team)}
      ${g.status==="final"?`<div class="notice" style="text-align:center;font-weight:900">最終スコア　${esc(teamName(g.away_team))} ${g.away_score} - ${g.home_score} ${esc(teamName(g.home_team))}</div>`:""}
      ${g.status==="cancelled"?'<div class="notice cancelled-note">シリーズ決着により、この試合は開催されません。配分P・BOOSTは未使用へ戻ります。</div>':""}
      ${state.actor.role==="player"&&g.status!=="cancelled"?`
      <div class="score-grid">
        <div><div class="team">${esc(teamName(g.away_team))}</div><input id="aw_${g.id}" class="field" type="number" min="0" max="30" value="${p?.away_score??""}" ${lock?"disabled":""}></div>
        <div><label class="label" style="text-align:center">配分P <span class="stake-limit">最大${stakeMax}</span></label><input id="st_${g.id}" class="field" type="number" min="1" max="${stakeMax}" value="${p?.stake??1}" ${lock?"disabled":""}></div>
        <div><div class="team">${esc(teamName(g.home_team))}</div><input id="ho_${g.id}" class="field" type="number" min="0" max="30" value="${p?.home_score??""}" ${lock?"disabled":""}></div>
      </div>
      <div class="boost-row"><label class="boost"><input id="bo_${g.id}" type="checkbox" ${p?.boost?"checked":""} ${lock?"disabled":""}> BOOSTを使う</label><span class="tiny">各ラウンド1回・獲得P×2</span></div>
      ${lock?"":p?`<div class="prediction-actions"><button class="btn" data-save-game="${g.id}">予想を更新</button><button class="btn ghost cancel-prediction" data-cancel-game="${g.id}">予想を取消</button></div>`:`<button class="btn danger" style="width:100%" data-save-game="${g.id}">✓ 予想を保存</button>`}
      ${p?`<div class="prediction-saved"><span>✓ 予想済み</span><b>${p.away_score} - ${p.home_score} ／ ${p.stake}P${p.boost?" ／ BOOST":""}</b></div>`:(!lock?'<div class="prediction-needed">この試合はまだ予想していません</div>':"")}
      `:""}
    </section>`;
  }
  return out;
}

function seriesView(){
  const mine=state.seriesPredictions.filter(x=>x.actor_id===state.actor.id);
  const open=state.series.filter(s=>!isLocked(s.starts_at,s.status));
  const unpredicted=open.filter(s=>!mine.some(p=>p.series_id===s.id)).length;
  const predicted=open.length-unpredicted;
  const ordered=[...state.series].sort((a,b)=>{
    const pa=mine.some(p=>p.series_id===a.id),pb=mine.some(p=>p.series_id===b.id);
    const la=isLocked(a.starts_at,a.status),lb=isLocked(b.starts_at,b.status);
    const wa=!la&&!pa?0:!la&&pa?1:2;
    const wb=!lb&&!pb?0:!lb&&pb?1:2;
    return wa-wb||new Date(a.starts_at)-new Date(b.starts_at);
  });
  return viewTitle("シリーズ予想","未予想のシリーズを上に表示しています。")+
  guideSteps(["勝者を選ぶ","最終成績を選ぶ","必要ならアップセットを選んで保存"])+
  (state.actor.role==="player"?`<div class="status-summary"><div class="status-count pending"><span>未予想</span><b>${unpredicted}</b></div><div class="status-count done"><span>予想済み</span><b>${predicted}</b></div><div class="status-count"><span>受付中</span><b>${open.length}</b></div></div>`:"")+
  ordered.map(s=>{
    const p=state.seriesPredictions.find(x=>x.series_id===s.id&&x.actor_id===state.actor.id),lock=isLocked(s.starts_at,s.status),need=s.round==="WCS"?2:s.round==="DS"?3:4;
    let cls="series-card",seriesPill=lock?'<span class="pill lock">締切</span>':'<span class="pill live">受付中</span>';
    if(state.actor.role==="player"){
      if(p&&!lock){cls+=" series-predicted";seriesPill='<span class="pill predicted">✓ 予想済</span>'}
      else if(!p&&!lock){cls+=" series-unpredicted";seriesPill='<span class="pill pending">● 未予想</span>'}
      else if(!p&&lock){cls+=" series-missed";seriesPill='<span class="pill missed">未予想で締切</span>'}
    }
    return `<section class="card ${cls}"><div class="status-line"><div class="muted">${esc(roundName(s.round))}</div>${seriesPill}</div>
      ${seriesTimingPanel(s.starts_at,s.status)}
      ${matchupBlock(s.team_a,s.team_b)}
      ${s.status==="final"?`<div class="notice">${esc(teamName(s.winner_team))} 勝利 · ${s.wins_a}-${s.wins_b}</div>`:""}
      ${state.actor.role==="player"?`
        <label class="label">シリーズ勝者</label><select id="sw_${s.id}" class="field" ${lock?"disabled":""}><option value="${esc(s.team_a)}" ${p?.winner_team===s.team_a?"selected":""}>${esc(teamName(s.team_a))}</option><option value="${esc(s.team_b)}" ${p?.winner_team===s.team_b?"selected":""}>${esc(teamName(s.team_b))}</option></select>
        <label class="label">シリーズ最終成績</label><select id="sl_${s.id}" class="field" ${lock?"disabled":""}>${Array.from({length:need},(_,n)=>`<option value="${n}" ${+p?.loser_wins===n?"selected":""}>${need}-${n}</option>`).join("")}</select>
        <div class="boost-row"><label><input id="su_${s.id}" type="checkbox" ${p?.upset?"checked":""} ${lock?"disabled":""}> アップセット予想</label><span class="tiny">下位シード勝利で×1.5</span></div>
        ${lock?"":`<button class="btn danger" style="width:100%" data-save-series="${s.id}">✓ シリーズ予想を保存</button>`}
        ${p?`<div class="prediction-saved"><span>✓ シリーズ予想済み</span><b>${esc(teamName(p.winner_team))} ／ ${need}-${p.loser_wins}</b></div>`:(!lock?'<div class="prediction-needed">このシリーズはまだ予想していません</div>':"")}
      `:""}
    </section>`
  }).join("");
}
function rankView(){
  return viewTitle("順位表","得点だけでなく、ベット試合数と勝敗も確認できます。")+
  `<section class="card glow"><div class="rank-list">${state.ranking.map((x,i)=>`
    <div class="rank-row rank-${i+1}">
      <div class="rank-no">${i+1}</div>
      <div class="rank-main"><b>${esc(x.player.display_name)}</b><div class="rank-record"><span class="record-bet">ベット <strong>${x.betGames??0}</strong>試合</span><span class="record-win"><strong>${x.wins??0}</strong>勝</span><span class="record-loss"><strong>${x.losses??0}</strong>敗</span><span class="record-rate">的中率 ${x.settledGames?Math.round(((x.wins??0)/x.settledGames)*100):0}%</span></div><div class="rank-meta"><span>試合 ${x.game}P</span><span>シリーズ ${x.series}P</span><span>大会前 ${x.pre}P</span><span>残り ${x.remaining}P</span></div></div>
      <div class="rank-score">${x.total}P</div>
    </div>`).join("")}</div></section>`;
}

function postseasonFieldCard(){
  const teamRow=(code,league)=>`<div class="postseason-team"><span class="seed-no">${POSTSEASON_SEED[code]}</span><div><b>${esc(teamName(code))}</b><small>${league} ${POSTSEASON_SEED[code]<=2?"1回戦免除":"ワイルドカード"}</small></div></div>`;
  return `<section class="card postseason-field">
    <div class="section-title"><div><div class="section-kicker">FINAL 12</div><h3>2026 ポストシーズン出場チーム</h3></div><span class="pill live">確定</span></div>
    <div class="postseason-leagues">
      <div><div class="league-head al">ア・リーグ</div>${POSTSEASON_AL.map(c=>teamRow(c,"AL")).join("")}</div>
      <div><div class="league-head nl">ナ・リーグ</div>${POSTSEASON_NL.map(c=>teamRow(c,"NL")).join("")}</div>
    </div>
    <div class="bracket-next">
      <b>地区シリーズの接続</b>
      <span>レイズ ← ヤンキース／レッドソックス勝者</span>
      <span>ガーディアンズ ← アストロズ／ホワイトソックス勝者</span>
      <span>ブルワーズ ← パドレス／カブス勝者</span>
      <span>ドジャース ← ブレーブス／フィリーズ勝者</span>
    </div>
  </section>`;
}

function preView(){
  const p=state.prePredictions.find(x=>x.actor_id===state.actor.id),lock=state.config.pre_lock_at&&new Date(state.config.pre_lock_at)<=new Date(state.serverTime);
  return viewTitle("大会前予想","確定したポストシーズン12球団からリーグ優勝・ワールドシリーズ優勝を予想します。")+postseasonFieldCard()+guideSteps(["AL・NL優勝","WS優勝","最終成績を保存"])+
  `<section class="card glow pre-card"><div class="section-title"><div><div class="section-kicker">PRESEASON PICKS</div><h3>優勝予想</h3></div>${lock?'<span class="pill lock">締切</span>':'<span class="pill live">受付中</span>'}</div>
  <div class="muted pre-deadline">締切：${jst(state.config.pre_lock_at)}</div>
  ${state.actor.role==="player"?`
  <div class="pre-pick-grid">
    <div class="pre-pick-group"><span class="pre-league al">AL</span><label class="label">ア・リーグ優勝</label><select id="preAL" class="field" ${lock?"disabled":""}>${teamOptions(POSTSEASON_AL,p?.al_champion||"")}</select></div>
    <div class="pre-pick-group"><span class="pre-league nl">NL</span><label class="label">ナ・リーグ優勝</label><select id="preNL" class="field" ${lock?"disabled":""}>${teamOptions(POSTSEASON_NL,p?.nl_champion||"")}</select></div>
    <div class="pre-pick-group ws"><span class="pre-league ws">WS</span><label class="label">ワールドシリーズ優勝</label><select id="preWS" class="field" ${lock?"disabled":""}>${teamOptions([p?.al_champion,p?.nl_champion].filter(Boolean),p?.ws_champion||"")}</select><label class="label">ワールドシリーズ最終成績</label><select id="preLW" class="field" ${lock?"disabled":""}>${[0,1,2,3].map(n=>`<option value="${n}" ${+p?.ws_loser_wins===n?"selected":""}>4-${n}</option>`).join("")}</select></div>
  </div>
  ${lock?"":'<button id="savePre" class="btn danger pre-save">✓ 大会前予想を保存</button>'}
  `:''}</section>`;
}

function adminView(){
  if(state.actor.role!=="admin")return "";
  const names=state.players.map(p=>`<label class="label">${esc(p.id.toUpperCase())}</label><input class="field" id="nm_${p.id}" value="${esc(p.display_name)}">`).join("");
  const pendingResults=state.games.filter(g=>g.status!=="final"&&g.status!=="cancelled").length;
  const completedGames=state.games.filter(g=>g.status==="final").length;
  const activeSeries=state.series.filter(s=>s.status==="active").length;
  const orderedGames=[...state.games].sort((a,b)=>(a.status==="final"?1:0)-(b.status==="final"?1:0)||new Date(a.starts_at)-new Date(b.starts_at));
  const now=new Date(state.serverTime);
  const gameRows=orderedGames.map(g=>{
    const final=g.status==="final",cancelled=g.status==="cancelled",started=new Date(g.starts_at)<=now,canResult=started&&!cancelled;
    const pill=cancelled?'<span class="pill cancelled">開催なし</span>':final?'<span class="pill final">反映済</span>':started?'<span class="pill pending">未確定</span>':'<span class="pill lock">開始待ち</span>';
    const rowClass=cancelled?"is-cancelled":final?"is-final":"needs-result";
    const disabled=canResult?"":"disabled";
    const label=cancelled?"開催なし":final?"結果を更新":started?"試合結果を確定":"開始待ち";
    return `<div class="admin-block result-row ${rowClass}">
      <div class="result-row-head"><div><b>${esc(teamName(g.away_team))} <span>@</span> ${esc(teamName(g.home_team))}</b><small>${jst(g.starts_at)}</small></div>${pill}</div>
      <div class="three-col result-inputs" style="margin-top:7px"><input class="field" id="ra_${g.id}" type="number" min="0" max="99" placeholder="アウェー" value="${g.away_score??""}" ${disabled}><input class="field" id="rh_${g.id}" type="number" min="0" max="99" placeholder="ホーム" value="${g.home_score??""}" ${disabled}><button class="btn ${final?"secondary":""}" data-result="${g.id}" ${disabled}>${label}</button></div>
    </div>`;
  }).join("");
  return viewTitle("管理者メニュー","結果反映を最優先に、プレイヤー設定・ラウンド管理・後続カード登録を行います。")+`
  <section class="admin-overview glass-admin">
    <div><span>未確定試合</span><b>${pendingResults}</b></div>
    <div><span>反映済試合</span><b>${completedGames}</b></div>
    <div><span>進行中シリーズ</span><b>${activeSeries}</b></div>
  </section>
  <details class="card admin-results" open><summary>試合結果入力</summary><div class="notice result-flow-note">結果確定後、試合得点 → シリーズ勝敗 → 順位表まで自動で再計算します。</div>${gameRows}</details>
  <details class="card"><summary>プレイヤー設定</summary><div class="admin-block">${names}<button id="saveNames" class="btn" style="width:100%;margin-top:10px">名前を保存</button></div>
    <div class="admin-block"><h3>PIN変更</h3><div class="two-col mobile-stack"><select id="pinPlayer" class="field">${state.players.map(p=>`<option value="${p.id}">${esc(p.display_name)}</option>`).join("")}<option value="admin">管理者</option></select><input id="newPin" class="field" maxlength="4" inputmode="numeric" placeholder="新しい4桁PIN"></div><button id="savePin" class="btn danger" style="width:100%;margin-top:8px">PINを変更</button></div>
  </details>
  <details class="card"><summary>ラウンド管理</summary><div class="admin-block">${state.rounds.map(r=>`<button class="btn ${r.closed?"secondary":""}" style="width:100%;margin:4px 0" data-round="${r.round}" data-closed="${r.closed}">${roundName(r.round)} ${r.closed?"再開":"終了"}</button>`).join("")}</div></details>
  <details class="card"><summary>大会前予想管理</summary><div class="admin-block"><label class="label">締切日時</label><input id="preLock" class="field" type="datetime-local" value="${localInput(state.config.pre_lock_at)}"><button id="savePreLock" class="btn" style="width:100%;margin-top:8px">締切を更新</button></div>
    <div class="admin-block"><label class="label">ア・リーグ優勝</label><input id="actualAL" class="field" placeholder="例：NYY"><label class="label">ナ・リーグ優勝</label><input id="actualNL" class="field" placeholder="例：LAD"><label class="label">ワールドシリーズ優勝</label><input id="actualWS" class="field" placeholder="例：LAD"><label class="label">WS最終成績</label><select id="actualLW" class="field">${[0,1,2,3].map(n=>`<option value="${n}">4-${n}</option>`).join("")}</select><button id="savePreResult" class="btn danger" style="width:100%;margin-top:8px">最終結果を確定・採点</button></div>
  </details>
  <details class="card"><summary>シリーズ / 試合登録</summary><div class="admin-block">
    <div class="notice">地区シリーズ以降や開始時刻変更用です。既存IDを入力すると編集、空欄なら新規登録です。</div>
    <label class="label">編集するシリーズ</label><select id="seriesId" class="field"><option value="">新規シリーズ</option>${state.series.map(x=>`<option value="${x.id}">${esc(x.code)}｜${esc(teamName(x.team_a))} vs ${esc(teamName(x.team_b))}</option>`).join("")}</select>
    <div class="two-col"><div><label class="label">シリーズコード</label><input id="seriesCode" class="field"></div><div><label class="label">リーグ</label><select id="seriesLeague" class="field"><option value="AL">ア・リーグ</option><option value="NL">ナ・リーグ</option></select></div></div>
    <label class="label">ラウンド</label><select id="seriesRound" class="field"><option value="WCS">ワイルドカード</option><option value="DS">地区シリーズ</option><option value="LCS">リーグ優勝決定シリーズ</option><option value="WS">ワールドシリーズ</option></select>
    <div class="two-col"><div><label class="label">チームA</label><input id="teamA" class="field" placeholder="例：NYY"></div><div><label class="label">チームB</label><input id="teamB" class="field" placeholder="例：BOS"></div></div>
    <div class="two-col"><div><label class="label">シードA</label><input id="seedA" class="field" type="number"></div><div><label class="label">シードB</label><input id="seedB" class="field" type="number"></div></div>
    <label class="label">開始日時</label><input id="seriesStart" class="field" type="datetime-local"><button id="saveSeriesAdmin" class="btn" style="width:100%;margin-top:8px">シリーズを保存</button>
    <div class="sep"></div>
    <label class="label">編集する試合</label><select id="gameId" class="field"><option value="">新規試合</option>${state.games.map(x=>`<option value="${x.id}">${esc(roundName(state.series.find(s=>s.id===x.series_id)?.round))} 第${x.game_no}戦｜${esc(teamName(x.away_team))} @ ${esc(teamName(x.home_team))}</option>`).join("")}</select><label class="label">シリーズ</label><select id="gameSeriesId" class="field"><option value="">選択してください</option>${state.series.map(x=>`<option value="${x.id}">${esc(x.code)}｜${esc(teamName(x.team_a))} vs ${esc(teamName(x.team_b))}</option>`).join("")}</select>
    <div class="three-col"><div><label class="label">第何戦</label><input id="gameNo" class="field" type="number" min="1" max="7"></div><div><label class="label">アウェー</label><input id="gameAway" class="field"></div><div><label class="label">ホーム</label><input id="gameHome" class="field"></div></div>
    <label class="label">開始日時</label><input id="gameStart" class="field" type="datetime-local"><button id="saveGameAdmin" class="btn" style="width:100%;margin-top:8px">試合を保存</button>
  </div></details>`;
}

function render(){
  if(state?.actor?.role==="player"&&state.actor.setup_required){renderSetup();return}
  const body=view==="home"?homeView():view==="games"?gamesView():view==="series"?seriesView():view==="rank"?rankView():view==="pre"?preView():adminView();
  app.innerHTML=shell(body);
  document.getElementById("logout").onclick=async()=>{try{await api("logout")}catch{}logoutLocal()};
  document.querySelectorAll("[data-view]").forEach(b=>b.onclick=()=>{view=b.dataset.view;render()});
  document.querySelectorAll("[data-go]").forEach(b=>b.onclick=()=>{view=b.dataset.go;render()});
  wireActions();
  const toast=document.getElementById("appToast");
  if(toast)setTimeout(()=>{toast.classList.add("hide");setTimeout(()=>{toastMessage=""},260)},2400);
}
function num(id){const e=document.getElementById(id),v=e?.value?.trim?.()??"";return v===""?null:Number(v)}
function val(id){return document.getElementById(id).value.trim()}
function validNums(values,message){if(values.some(v=>v===null||!Number.isFinite(v))){alert(message);return false}return true}
function isoVal(id){const v=document.getElementById(id)?.value?.trim?.()||"";if(!v)return null;const d=new Date(v);return Number.isNaN(d.getTime())?null:d.toISOString()}
function successText(action){
  return ({
    saveGamePrediction:"試合予想を保存しました。",
    deleteGamePrediction:"予想を取り消しました。配分PとBOOSTを未使用へ戻しました。",
    saveSeriesPrediction:"シリーズ予想を保存しました。",
    savePrePrediction:"大会前予想を保存しました。",
    adminSetGameResult:"試合結果を反映しました。採点・シリーズ勝敗・順位表を更新しました。",
    adminSetPlayers:"プレイヤー名を更新しました。",
    adminSetPin:"PINを更新しました。",
    adminSetRoundClosed:"ラウンド状態を更新しました。",
    adminSetPreLock:"大会前予想の締切を更新しました。",
    adminSetPreResult:"大会前結果を確定し、順位表を更新しました。",
    adminUpsertSeries:"シリーズ情報を保存しました。",
    adminUpsertGame:"試合情報を保存しました。"
  })[action]||"更新しました。";
}
async function mutate(action,payload,confirmText){
  if(confirmText&&!confirm(confirmText))return;
  try{setBusy(true);state=await api(action,payload);toastMessage=successText(action);render()}catch(e){alert(errorText(e));setBusy(false)}
}
function wireActions(){
  document.querySelectorAll("[data-save-game]").forEach(b=>b.onclick=()=>{
    const id=b.dataset.saveGame,aw=num("aw_"+id),ho=num("ho_"+id),stake=num("st_"+id);
    if(!validNums([aw,ho,stake],"予想スコアと配分Pをすべて入力してください。"))return;
    if(aw===ho){alert("引き分けスコアは予想できません。");return}
    mutate("saveGamePrediction",{gameId:id,awayScore:aw,homeScore:ho,stake,boost:document.getElementById("bo_"+id).checked});
  });
  document.querySelectorAll("[data-cancel-game]").forEach(b=>b.onclick=()=>{
    const id=b.dataset.cancelGame;
    mutate("deleteGamePrediction",{gameId:id},"この試合の予想を取り消します。配分ポイントとBOOSTは未使用に戻ります。よろしいですか？");
  });
  document.querySelectorAll("[data-save-series]").forEach(b=>b.onclick=()=>{
    const id=b.dataset.saveSeries;
    mutate("saveSeriesPrediction",{seriesId:id,winnerTeam:val("sw_"+id),loserWins:num("sl_"+id),upset:document.getElementById("su_"+id).checked});
  });
  const preAL=document.getElementById("preAL"),preNL=document.getElementById("preNL");
  if(preAL)preAL.onchange=syncPreWsChoices;
  if(preNL)preNL.onchange=syncPreWsChoices;
  syncPreWsChoices();
  const pre=document.getElementById("savePre");
  if(pre)pre.onclick=()=>{
    const al=val("preAL"),nl=val("preNL"),ws=val("preWS");
    if(!al||!nl||!ws){alert("AL・NL・ワールドシリーズ優勝予想を選択してください。");return}
    mutate("savePrePrediction",{alChampion:al,nlChampion:nl,wsChampion:ws,wsLoserWins:num("preLW")});
  };
  if(state.actor.role!=="admin"||view!=="admin")return;
  document.getElementById("saveNames").onclick=()=>mutate("adminSetPlayers",{names:state.players.map(p=>val("nm_"+p.id))},"5名の表示名を変更します。よろしいですか？");
  document.getElementById("savePin").onclick=()=>{
    const pin=val("newPin");
    if(!/^\d{4}$/.test(pin)){alert("PINは4桁の数字で入力してください。");return}
    mutate("adminSetPin",{playerId:val("pinPlayer"),pin},"PINを変更すると対象ユーザーは再ログインが必要です。続行しますか？");
  };
  document.querySelectorAll("[data-result]").forEach(b=>b.onclick=()=>{
    const id=b.dataset.result,aw=num("ra_"+id),ho=num("rh_"+id);
    if(!validNums([aw,ho],"アウェー・ホームの最終スコアを入力してください。"))return;
    if(aw===ho){alert("引き分けスコアは確定できません。");return}
    mutate("adminSetGameResult",{gameId:id,awayScore:aw,homeScore:ho},"この試合結果を確定し、自動採点します。よろしいですか？");
  });
  document.querySelectorAll("[data-round]").forEach(b=>b.onclick=()=>mutate("adminSetRoundClosed",{round:b.dataset.round,closed:b.dataset.closed!=="true"},b.dataset.closed==="true"?"このラウンドを再開しますか？":"ラウンドを終了します。未使用最低枠は失効します。よろしいですか？"));
  document.getElementById("savePreLock").onclick=()=>{
    const preLockAt=isoVal("preLock");
    if(!preLockAt){alert("大会前予想の締切日時を入力してください。");return}
    mutate("adminSetPreLock",{preLockAt},"大会前予想の締切日時を変更しますか？");
  };
  document.getElementById("savePreResult").onclick=()=>mutate("adminSetPreResult",{alChampion:val("actualAL"),nlChampion:val("actualNL"),wsChampion:val("actualWS"),wsLoserWins:num("actualLW")},"大会前予想の最終結果を確定して採点します。よろしいですか？");
  const seriesSel=document.getElementById("seriesId");
  if(seriesSel)seriesSel.onchange=()=>{
    const x=state.series.find(v=>v.id===seriesSel.value);
    if(!x)return;
    document.getElementById("seriesCode").value=x.code||"";
    document.getElementById("seriesLeague").value=x.league||"AL";
    document.getElementById("seriesRound").value=x.round||"WCS";
    document.getElementById("teamA").value=x.team_a||"";
    document.getElementById("teamB").value=x.team_b||"";
    document.getElementById("seedA").value=x.seed_a??"";
    document.getElementById("seedB").value=x.seed_b??"";
    document.getElementById("seriesStart").value=localInput(x.starts_at);
  };
  const gameSel=document.getElementById("gameId");
  if(gameSel)gameSel.onchange=()=>{
    const x=state.games.find(v=>v.id===gameSel.value);
    if(!x)return;
    document.getElementById("gameSeriesId").value=x.series_id||"";
    document.getElementById("gameNo").value=x.game_no??"";
    document.getElementById("gameAway").value=x.away_team||"";
    document.getElementById("gameHome").value=x.home_team||"";
    document.getElementById("gameStart").value=localInput(x.starts_at);
  };
  document.getElementById("saveSeriesAdmin").onclick=()=>{
    const startsAt=isoVal("seriesStart");
    if(!startsAt){alert("シリーズ開始日時を入力してください。");return}
    mutate("adminUpsertSeries",{id:val("seriesId"),code:val("seriesCode"),league:val("seriesLeague"),round:val("seriesRound"),teamA:val("teamA"),teamB:val("teamB"),seedA:val("seedA")||null,seedB:val("seedB")||null,startsAt,status:"scheduled"},"シリーズ情報を保存しますか？");
  };
  document.getElementById("saveGameAdmin").onclick=()=>{
    const startsAt=isoVal("gameStart"),gameNo=num("gameNo");
    if(!startsAt||gameNo===null){alert("試合番号と開始日時を入力してください。");return}
    mutate("adminUpsertGame",{id:val("gameId"),seriesId:val("gameSeriesId"),gameNo,awayTeam:val("gameAway"),homeTeam:val("gameHome"),startsAt,status:"scheduled"},"試合情報を保存しますか？");
  };
}
if(token)refresh();else renderLogin();
setInterval(()=>{if(token&&!busy)refresh()},30000);
