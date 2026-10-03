const uiOriginalPlayerRender=j.prototype.render;
const uiOriginalPlayerShow=j.prototype.show;
j.prototype.show=function(){
  this.el.scrollTop=0;
  this.el.scrollLeft=0;
  uiOriginalPlayerShow.call(this);
  requestAnimationFrame(()=>{
    this.el.scrollTop=0;
    this.el.scrollLeft=0;
  });
};

j.prototype.render=function(){
  uiOriginalPlayerRender.call(this);
  const queue=this.el.querySelector('.player-queue-container');
  queue.setAttribute('aria-label','재생 대기열');
  queue.querySelector('.queue-title-wrap span').textContent='재생 대기열';
  const trigger=this.el.querySelector('#queue-toggle-btn');
  trigger.title='재생 대기열';trigger.setAttribute('aria-label','재생 대기열 보기');
  trigger.setAttribute('aria-expanded','false');
  trigger.addEventListener('click',()=>{
    const open=this.el.classList.contains('show-queue');
    trigger.setAttribute('aria-expanded',String(open));
    this.el.querySelector('.player-header > div').textContent=open?'재생 대기열':'지금 재생 중';
    if(open)this.el.querySelector('.queue-item.cloud-next')?.scrollIntoView({block:'nearest'});
  });
  this.el.querySelector('.player-header > div').textContent='지금 재생 중';
  this.el.querySelector('#minimize-btn').setAttribute('aria-label','플레이어 접기');
  for(const [id,label] of [['player-prev-btn','이전 곡'],['player-next-btn','다음 곡'],['player-shuffle-btn','셔플'],['player-repeat-btn','반복 재생'],['player-download-btn','오프라인 저장']])this.el.querySelector('#'+id).setAttribute('aria-label',label);
  const status=uiText('div','ui-playback-status','');status.setAttribute('role','status');this.el.querySelector('.bar-left').append(status);
  cloudEnhancePlayerRender.call(this);
};
const uiOriginalQueue=j.prototype.renderQueue;j.prototype.renderQueue=function(){
  if(!this.el.classList.contains('show-queue')){cloudEnhanceQueue.call(this);return;}
  uiOriginalQueue.call(this);
  const queueTracks=this.getQueue();
  this.el.querySelectorAll('.queue-item[data-index]').forEach(row=>{
    const track=queueTracks[Number(row.dataset.index)];
    const artwork=row.querySelector('.queue-item-art');
    if(track&&artwork){artwork.dataset.artworkProbe=String(track.id);uiUpgradeArtworkBackground(artwork,track);}
  });
  cloudEnhanceQueue.call(this);
};
const uiOriginalHide=j.prototype.hide;j.prototype.hide=function(){this.el.classList.remove('show-queue');const trigger=this.el.querySelector('#queue-toggle-btn');trigger.setAttribute('aria-expanded','false');trigger.style.color='';this.el.querySelector('.player-header > div').textContent='지금 재생 중';uiOriginalHide.call(this);};
function uiEnsureArtwork(element, track, backgroundElement) {
  if (!element || !track || track.id == null) return;
  const artworkId = String(track.id);
  if (element.dataset.artworkProbe === artworkId) {
    if(element.dataset.artworkLoaded){element.style.backgroundImage=element.dataset.artworkLoaded;element.replaceChildren();}
    uiUpgradeArtworkBackground(element,track,backgroundElement);
    return;
  }
  delete element.dataset.artworkLoaded;
  delete element.dataset.highResolutionUrl;
  delete element.dataset.artworkUpgradePending;
  delete element.dataset.artworkSize;
  element.dataset.artworkProbe = artworkId;
  const url = w.getArtworkUrl(track.id);
  const image = new Image();
  image.onload = () => {
    if (element.dataset.artworkProbe !== artworkId) return;
    const size = Math.min(image.naturalWidth || 0, image.naturalHeight || 0);
    if (element.dataset.highResolutionUrl && size <= Number(element.dataset.artworkSize || 0)) return;
    element.dataset.artworkSize = String(size);
    element.style.backgroundImage = `url("${url}")`;
    element.dataset.artworkLoaded = `url("${url}")`;
    element.style.backgroundSize = 'cover';
    element.style.backgroundPosition = 'center';
    element.replaceChildren();
    if (backgroundElement) backgroundElement.style.backgroundImage = `url("${url}")`;
  };
  image.onerror = () => {
    if(element.dataset.artworkProbe!==artworkId)return;
    if(element.dataset.highResolutionUrl)return;
    element.style.backgroundImage='none';
    element.replaceChildren(uiText('span','', '♪'));
  };
  image.src = url;
  uiUpgradeArtworkBackground(element,track,backgroundElement);
}
const uiOriginalState=j.prototype.updateState;j.prototype.updateState=function(state){uiOriginalState.call(this,state);const loading=state.isLoading?'재생을 준비하고 있어요':state.currentTrack?(state.isPlaying?'재생 중':'일시정지'):'';const status=this.el.querySelector('.ui-playback-status');if(status&&status.textContent!==loading)status.textContent=loading;this.el.querySelector('#full-play-btn').setAttribute('aria-label',state.isPlaying?'일시정지':'재생');this.el.querySelector('#player-repeat-btn').setAttribute('aria-label',`반복: ${state.repeat==='all'?'전체':state.repeat==='one'?'한 곡':'끔'}`);uiEnsureArtwork(this.el.querySelector('#full-art'),state.currentTrack,this.el.querySelector('.player-bg-blur'));cloudEnhancePlayerState.call(this,state);};
const uiOriginalMini=J.prototype.render;J.prototype.render=function(){
  uiOriginalMini.call(this);
  const area=this.el.querySelector('#np-expand-area');
  area.tabIndex=0;
  area.setAttribute('role','button');
  area.setAttribute('aria-label','전체 플레이어 열기');
  area.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();this.onExpand();}});
  const next=document.createElement('button');
  next.type='button';
  next.id='np-next-btn';
  next.className='btn-icon np-next-btn';
  next.title='다음 곡';
  next.setAttribute('aria-label','다음 곡');
  next.innerHTML='<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M5 4.5v15l12-7.5L5 4.5Z"/><path d="M18 4.5h2v15h-2z"/></svg>';
  this.el.querySelector('#np-play-btn').after(next);
  next.addEventListener('click',event=>{
    event.stopPropagation();
    window.dispatchEvent(new CustomEvent('player:next'));
  });
};
const uiOriginalMiniState=J.prototype.updateState;J.prototype.updateState=function(state){uiOriginalMiniState.call(this,state);uiEnsureArtwork(this.el.querySelector('.np-art'),state.currentTrack);};


let uiSelectedTrack=null;p.subscribe(state=>{if(uiSelectedTrack!==state.currentTrack?.id){uiSelectedTrack=state.currentTrack?.id;document.querySelectorAll('.track-item[data-id]').forEach(row=>row.classList.toggle('ui-current',row.dataset.id===uiSelectedTrack));}document.querySelector('#np-play-btn')?.setAttribute('aria-label',state.isPlaying?'일시정지':'재생');});
