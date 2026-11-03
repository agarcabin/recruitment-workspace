(() => {
  'use strict';
  const panel = document.getElementById('task-panel');
  const priorities = [{value:5,name:'高优先级',color:'high'},{value:3,name:'中优先级',color:'medium'},{value:1,name:'低优先级',color:'low'},{value:0,name:'无优先级',color:'none'}];
  let data, loading=false, query='', collapsed=new Set(), board, count, dialog, detail, searchInput, reload;
  let view='board', timeline, viewButtons=[], rangeStart=null, rangeEnd=null;
  const DAY=86400000;
  function dateKey(value) {
    if(!value||!Number.isFinite(new Date(value).getTime()))return null;
    const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(value));
    return ['year','month','day'].map(type=>parts.find(p=>p.type===type).value).join('-');
  }
  function day(value) {const key=dateKey(value);return key?Date.parse(key+'T00:00:00Z'):null;}
  function dayLabel(value) {return new Date(value).toISOString().slice(0,10);}
  function schedule(task) {
    const start=day(task.startDate),end=day(task.dueDate);
    if(start===null&&end===null)return null;
    return {start:start??end,end:Math.max(start??end,end??start)};
  }
  function el(tag,cls,text) {const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;}
  function color(task) {return priorities.find(p=>p.value===(task.priority||0))?.color||'none';}
  function priorityName(task) {return priorities.find(p=>p.value===(task.priority||0))?.name||'无优先级';}
  function children(project,task) {return project.tasks.filter(t=>t.parentId===task.id);}
  function matches(project,task,seen=new Set()) {
    if(seen.has(task.id))return false;seen.add(task.id);
    const haystack=[task.title,task.content,task.desc,...(task.items||[]).map(i=>i.title)].filter(Boolean).join(' ').toLocaleLowerCase();
    return !query||haystack.includes(query)||children(project,task).some(child=>matches(project,child,seen));
  }
  function descendants(project,task,seen=new Set()) {
    if(seen.has(task.id))return [];seen.add(task.id);
    return [task,...children(project,task).flatMap(child=>descendants(project,child,seen))];
  }
  function taskControl(project,task,nested=false) {
    const row=el('div','dev-task-row');
    const kids=children(project,task);
    const toggle=el('button','dev-tree-toggle',kids.length?(collapsed.has(task.id)?'›':'⌄'):'');toggle.type='button';
    if(kids.length){toggle.setAttribute('aria-label',`${collapsed.has(task.id)?'展开':'收起'}${task.title}的子任务`);toggle.setAttribute('aria-expanded',String(!collapsed.has(task.id)));toggle.addEventListener('click',()=>{collapsed.has(task.id)?collapsed.delete(task.id):collapsed.add(task.id);renderBoard();board.querySelector(`[data-toggle="${task.id}"]`)?.focus();});toggle.dataset.toggle=task.id;row.append(toggle);}
    const button=el('button','dev-task-open');button.type='button';button.setAttribute('aria-label',`查看任务：${task.title}`);
    const square=el('span',`dev-check ${color(task)}`);square.setAttribute('aria-hidden','true');
    const copy=el('span','dev-task-copy');copy.append(el('span','dev-task-title',task.title));
    const description=task.content||task.desc||(task.items?.[0]?.title?`· ${task.items[0].title}`:'');
    if(description)copy.append(el('span','dev-task-description',description));
    if(!nested)copy.append(el('span','dev-task-project',project.name));
    if(task.items?.length)copy.append(el('span','dev-task-items',`☷ ${task.items.filter(i=>i.status===1||i.status===2).length}/${task.items.length} 检查项`));
    button.append(square,copy);button.addEventListener('click',()=>openTask(project,task));row.append(button);return row;
  }
  function card(project,task) {
    const card=el('article','dev-card');card.append(taskControl(project,task));
    const kids=children(project,task);
    if(kids.length&&!collapsed.has(task.id)){
      const nested=el('div','dev-children');
      for(const child of kids){const childCard=el('div','dev-child');childCard.append(taskControl(project,child,true));nested.append(childCard);}
      card.append(nested);
    }
    return card;
  }
  function renderBoard() {
    board.replaceChildren();let totalMatches=0;
    for(const project of data.projects){
      const ids=new Set(project.tasks.map(t=>t.id));
      const roots=project.tasks.filter(t=>!t.parentId||!ids.has(t.parentId));
      const visible=roots.filter(t=>matches(project,t));
      if(query&&!visible.length)continue;
      const column=el('section','dev-column');column.setAttribute('aria-label',project.name);
      const header=el('div','dev-column-head');const h2=el('h2','',project.name);h2.append(el('span','dev-column-count',String(project.tasks.length)));header.append(h2);column.append(header);
      const body=el('div','dev-column-body');
      for(const priority of priorities){
        const tasks=visible.filter(t=>(t.priority||0)===priority.value);
        if(!tasks.length)continue;
        const section=el('details','dev-priority');section.open=true;
        const sum=tasks.reduce((n,t)=>n+descendants(project,t).length,0);
        const heading=el('summary','dev-priority-heading',priority.name);heading.append(el('span','',String(sum)));section.append(heading);
        for(const task of tasks)section.append(card(project,task));body.append(section);
      }
      if(!visible.length)body.append(el('p','dev-column-empty','暂无未完成任务'));
      column.append(body);board.append(column);
      totalMatches+=project.tasks.filter(t=>[t.title,t.content,t.desc,...(t.items||[]).map(i=>i.title)].filter(Boolean).join(' ').toLocaleLowerCase().includes(query)).length;
    }
    if(!board.children.length)board.append(el('div','dev-empty','没有找到匹配的任务，试试其他关键词。'));
    const all=data.projects.reduce((n,p)=>n+p.tasks.length,0);
    count.textContent=query?`找到 ${totalMatches} 项匹配任务`:`${data.projects.length} 个项目 · ${all} 项未完成任务`;
  }
  function renderView() {
    renderBoard();board.hidden=view!=='board';timeline.hidden=view!=='timeline';
    viewButtons.forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.view===view)));
    if(view==='timeline')renderTimeline();
  }
  function fitSchedule() {
    const dates=data.projects.flatMap(p=>p.tasks.map(schedule).filter(Boolean));
    const today=day(new Date());
    rangeStart=dates.length?Math.min(...dates.map(d=>d.start))-DAY:today;
    rangeEnd=dates.length?Math.max(...dates.map(d=>d.end))+DAY:today+13*DAY;
  }
  function renderTimeline() {
    timeline.replaceChildren();
    if(rangeStart===null)fitSchedule();
    const controls=el('div','dev-timeline-controls');
    const range=el('strong','dev-range',`${dayLabel(rangeStart)} — ${dayLabel(rangeEnd)}`);range.setAttribute('aria-live','polite');controls.append(range);
    const nav=el('div','dev-range-actions');
    for(const [text,label,action]of[
      ['←','向前查看两周',()=>{rangeStart-=14*DAY;rangeEnd-=14*DAY;}],
      ['今天','查看从今天开始的两周',()=>{rangeStart=day(new Date());rangeEnd=rangeStart+13*DAY;}],
      ['→','向后查看两周',()=>{rangeStart+=14*DAY;rangeEnd+=14*DAY;}],
      ['全部排期','显示全部任务排期',fitSchedule]
    ]){const button=el('button','dev-reload',text);button.type='button';button.setAttribute('aria-label',label);button.addEventListener('click',()=>{action();renderTimeline();});nav.append(button);}
    controls.append(nav);timeline.append(controls);
    const days=Math.round((rangeEnd-rangeStart)/DAY)+1;
    const scroll=el('div','dev-timeline-scroll');scroll.tabIndex=0;scroll.setAttribute('role','region');scroll.setAttribute('aria-label','任务时间线，可横向滚动查看日期');
    const grid=el('div','dev-timeline-grid');grid.style.setProperty('--days',days);
    const heading=el('div','dev-timeline-heading');heading.append(el('div','dev-timeline-label','项目 / 任务'));
    const ticks=el('div','dev-timeline-days');const today=day(new Date());
    for(let i=0;i<days;i++){const value=rangeStart+i*DAY;const date=new Date(value);const tick=el('div','dev-timeline-day',`${date.getUTCMonth()+1}/${date.getUTCDate()}`);if(value===today){tick.classList.add('today');tick.title='今天';}if([0,6].includes(date.getUTCDay()))tick.classList.add('weekend');ticks.append(tick);}
    heading.append(ticks);grid.append(heading);
    let scheduledCount=0,visibleCount=0,undatedCount=0;
    const unscheduled=el('div','dev-unscheduled');const unscheduledHeading=el('h2','','未排期');unscheduled.append(unscheduledHeading);
    for(const project of data.projects){
      const matched=project.tasks.filter(t=>matches(project,t));
      const dated=matched.filter(t=>schedule(t));const undated=matched.filter(t=>!schedule(t));
      scheduledCount+=dated.length;undatedCount+=undated.length;
      const visible=dated.filter(t=>{const d=schedule(t);return d.start<=rangeEnd&&d.end>=rangeStart;}).sort((a,b)=>schedule(a).start-schedule(b).start);
      if(visible.length){
        const projectRow=el('div','dev-timeline-project',project.name);grid.append(projectRow);
        for(const task of visible){
          visibleCount++;const d=schedule(task);const row=el('div','dev-timeline-row');
          const label=el('button','dev-timeline-label dev-timeline-task',task.title);label.type='button';label.addEventListener('click',()=>openTask(project,task));
          const parent=project.tasks.find(t=>t.id===task.parentId);if(parent)label.append(el('small','',`子任务 · ${parent.title}`));
          const track=el('div','dev-timeline-track');
          if(today>=rangeStart&&today<=rangeEnd){const line=el('span','dev-today-line');line.style.left=`${(today-rangeStart)/DAY/days*100}%`;line.setAttribute('aria-hidden','true');track.append(line);}
          const bar=el('button',`dev-timeline-bar ${color(task)}`,task.title);bar.type='button';
          const dates=d.start===d.end?dayLabel(d.start):`${dayLabel(d.start)} — ${dayLabel(d.end)}`;
          bar.title=`${task.title} · ${dates} · ${priorityName(task)}`;bar.setAttribute('aria-label',`查看任务：${bar.title}`);
          bar.style.left=`${(Math.max(d.start,rangeStart)-rangeStart)/DAY/days*100}%`;
          bar.style.width=`${((Math.min(d.end,rangeEnd)-Math.max(d.start,rangeStart))/DAY+1)/days*100}%`;
          bar.addEventListener('click',()=>openTask(project,task));track.append(bar);row.append(label,track);grid.append(row);
        }
      }
      if(undated.length){const group=el('section','dev-unscheduled-project');group.append(el('h3','',`${project.name} · ${undated.length}`));for(const task of undated){const button=el('button','dev-undated-task',task.title);button.type='button';button.addEventListener('click',()=>openTask(project,task));const parent=project.tasks.find(t=>t.id===task.parentId);if(parent)button.append(el('small','',`子任务 · ${parent.title}`));group.append(button);}unscheduled.append(group);}
    }
    const summary=el('p','dev-timeline-summary',`已排期 ${scheduledCount} 项 · 当前范围 ${visibleCount} 项 · 未排期 ${undatedCount} 项`);summary.setAttribute('role','status');timeline.append(summary);
    if(visibleCount){scroll.append(grid);timeline.append(scroll);}else timeline.append(el('p','dev-empty',scheduledCount?'当前日期范围内没有任务。点击“全部排期”查看其他日期。':query?'没有匹配的已排期任务。':'暂时没有设置日期的任务。可在滴答清单中设置开始或截止日期，更新快照后将在这里展示。'));
    timeline.append(el('p','dev-timeline-hint','日期按北京时间展示；横条表示开始至截止日期，点击可查看详情。'));
    if(undatedCount){unscheduledHeading.textContent=`未排期 · ${undatedCount}`;timeline.append(unscheduled);}
  }
  function createDialog() {
    dialog=el('dialog','dev-dialog');dialog.setAttribute('aria-labelledby','dev-detail-title');
    const head=el('div','dev-dialog-head','任务详情');const close=el('button','dev-close','×');close.type='button';close.setAttribute('aria-label','关闭任务详情');close.addEventListener('click',()=>dialog.close());head.append(close);dialog.append(head);
    detail=el('div','dev-detail');dialog.append(detail);panel.append(dialog);
  }
  function openTask(project,task) {
    detail.replaceChildren();detail.append(el('span',`dev-priority-pill ${color(task)}`,priorityName(task)));
    const heading=el('h2','',task.title);heading.id='dev-detail-title';detail.append(heading);
    const meta=el('dl','dev-meta');
    for(const [name,value]of[['项目',project.name],['状态','未完成'],['开始',dateKey(task.startDate)||'未设置'],['截止',dateKey(task.dueDate)||'未设置']])meta.append(el('dt','',name),el('dd','',value));
    const parent=project.tasks.find(t=>t.id===task.parentId);if(parent)meta.append(el('dt','','父任务'),el('dd','',parent.title));detail.append(meta);
    if(task.content||task.desc)detail.append(el('h3','','任务说明'),el('p','dev-detail-text',task.content||task.desc));
    if(task.items?.length){detail.append(el('h3','','检查项'));const list=el('ul','dev-detail-list');for(const item of task.items)list.append(el('li','',`${item.status===1||item.status===2?'✓':'□'} ${item.title}`));detail.append(list);}
    const kids=children(project,task);if(kids.length){detail.append(el('h3','',`子任务 · ${kids.length}`));const list=el('ul','dev-detail-list');for(const child of kids)list.append(el('li','',child.title));detail.append(list);}
    detail.append(el('p','dev-detail-notice','此页面展示滴答清单的任务快照。任务状态以滴答清单为准。'));dialog.showModal();
  }
  function build() {
    panel.replaceChildren();
    const toolbar=el('div','dev-toolbar');const meta=el('div','dev-source');count=el('span','dev-total');meta.append(count);
    const time=new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(data.capturedAt));
    meta.append(el('span','dev-snapshot',`滴答快照 · ${time}`));toolbar.append(meta);
    const controls=el('div','dev-controls');const switcher=el('div','dev-view-switch');switcher.setAttribute('role','group');switcher.setAttribute('aria-label','任务视图');viewButtons=[];
    for(const [key,name]of[['board','看板'],['timeline','时间线']]){const button=el('button','',name);button.type='button';button.dataset.view=key;button.addEventListener('click',()=>{view=key;renderView();});switcher.append(button);viewButtons.push(button);}controls.append(switcher);
    const label=el('label','dev-search');label.append(el('span','','⌕'));
    searchInput=el('input');searchInput.type='search';searchInput.placeholder='搜索任务、说明或检查项';searchInput.setAttribute('aria-label','搜索开发任务');searchInput.value=query;searchInput.addEventListener('input',()=>{query=searchInput.value.trim().toLocaleLowerCase();renderView();});label.append(searchInput);controls.append(label);
    reload=el('button','dev-reload','重新加载');reload.type='button';reload.addEventListener('click',()=>load(true));controls.append(reload);toolbar.append(controls);panel.append(toolbar);
    board=el('div','dev-board');timeline=el('div','dev-timeline');panel.append(board,timeline,el('p','dev-footnote','看板按项目与优先级分组；时间线按任务日期展示。当前为只读快照。'));
    createDialog();renderView();
  }
  async function load(force=false) {
    if(loading||(data&&!force))return;loading=true;if(reload)reload.disabled=true;
    try{
      const response=await fetch('./data/ai-development.json',{cache:'no-store'});if(!response.ok)throw new Error('snapshot unavailable');
      const incoming=await response.json();if(!Array.isArray(incoming.projects)||!incoming.capturedAt)throw new Error('invalid snapshot');data=incoming;build();
    }catch(error){const box=el('div','dev-empty','任务快照暂时无法加载。');const retry=el('button','dev-reload','重试');retry.type='button';retry.addEventListener('click',()=>load(true));box.append(retry);panel.replaceChildren(box);}
    finally{loading=false;if(reload)reload.disabled=false;}
  }
  document.addEventListener('task-preview:open',()=>load());if(location.hash==='#tasks')load();
})();
