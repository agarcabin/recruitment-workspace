(() => {
  'use strict';
  const panel = document.getElementById('task-panel');
  const priorities = [{value:5,name:'高优先级',color:'high'},{value:3,name:'中优先级',color:'medium'},{value:1,name:'低优先级',color:'low'},{value:0,name:'无优先级',color:'none'}];
  let data, loading=false, query='', collapsed=new Set(), board, count, dialog, detail, searchInput, reload;
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
  function createDialog() {
    dialog=el('dialog','dev-dialog');dialog.setAttribute('aria-labelledby','dev-detail-title');
    const head=el('div','dev-dialog-head','任务详情');const close=el('button','dev-close','×');close.type='button';close.setAttribute('aria-label','关闭任务详情');close.addEventListener('click',()=>dialog.close());head.append(close);dialog.append(head);
    detail=el('div','dev-detail');dialog.append(detail);panel.append(dialog);
  }
  function openTask(project,task) {
    detail.replaceChildren();detail.append(el('span',`dev-priority-pill ${color(task)}`,priorityName(task)));
    const heading=el('h2','',task.title);heading.id='dev-detail-title';detail.append(heading);
    const meta=el('dl','dev-meta');
    for(const [name,value]of[['项目',project.name],['状态','未完成'],['日期',(task.dueDate||task.startDate)?.slice(0,10)||'未设置']])meta.append(el('dt','',name),el('dd','',value));
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
    const controls=el('div','dev-controls');const label=el('label','dev-search');label.append(el('span','','⌕'));
    searchInput=el('input');searchInput.type='search';searchInput.placeholder='搜索任务、说明或检查项';searchInput.setAttribute('aria-label','搜索开发任务');searchInput.value=query;searchInput.addEventListener('input',()=>{query=searchInput.value.trim().toLocaleLowerCase();renderBoard();});label.append(searchInput);controls.append(label);
    reload=el('button','dev-reload','重新加载');reload.type='button';reload.addEventListener('click',()=>load(true));controls.append(reload);toolbar.append(controls);panel.append(toolbar);
    board=el('div','dev-board');panel.append(board,el('p','dev-footnote','按项目分栏、按优先级分组；父任务内展示子任务。当前为只读快照，尚未开启自动回写。'));
    createDialog();renderBoard();
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
