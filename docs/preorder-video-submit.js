form.dataset.linkPoPreflight='1';
form.onsubmit=async function(e){
    e.preventDefault();if(form.dataset.linkPoSubmitting)return false;form.dataset.linkPoSubmitting='1';
    try{
      if(typeof window.LinkPreorderCheckItems!=='function')throw Error('preorder_guard_unavailable');
      if(!await window.LinkPreorderCheckItems([{id:pr.id}],{nativeForm:form}))return false;
      window.lvsTrack('product_click',document.getElementById('lvs-viewer').dataset.videoid,pr.id);
      return await salla.form.onSubmit('cart.addItem',e);
    }catch(_){salla.notify?.error?.('تعذر التحقق من السلة؛ حاول مجدداً.');return false;}
    finally{delete form.dataset.linkPoSubmitting;}
  };
