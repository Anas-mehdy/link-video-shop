form.onsubmit=async function(e){
    e.preventDefault();if(form.dataset.linkPoSubmitting)return false;form.dataset.linkPoSubmitting='1';
    try{
      if(window.LinkPreorderCheckItems&&!await window.LinkPreorderCheckItems([{id:pr.id}]))return false;
      window.lvsTrack('product_click',document.getElementById('lvs-viewer').dataset.videoid,pr.id);
      return await salla.form.onSubmit('cart.addItem',e);
    }catch(_){salla.notify?.error?.('تعذر التحقق من السلة؛ حاول مجدداً.');return false;}
    finally{delete form.dataset.linkPoSubmitting;}
  };
