

/** Gestione cornici **/

// Funzione che sincronizza la selezione del valore "selectedValue"
// all'interno di tutti i .RB_PC_Selector dentro .RB_Product_Card.
/**
 * @param {string} selectedValue
 */
function syncRBPCSelect(selectedValue) {
  // Seleziona tutte le card presenti
  const productCards = document.querySelectorAll('.RB_Addon_Wrapper .RB_Product_Card');

  // Se non troviamo nessuna card, probabilmente la sezione non è ancora stata caricata.
  if (productCards.length === 0) {
    return false;
  }

  // Flag per capire se abbiamo trovato almeno una corrispondenza
  let foundMatch = false;

  productCards.forEach(card => {
    // Recupera la select
    const selector = card.querySelector('.RB_PC_Selector');
    if (!(selector instanceof HTMLSelectElement)) return;

    // Prova a trovare, tra le opzioni, quella con value == selectedValue
    const optionToSelect = Array.from(selector.options).find(opt => opt.value.trim() === selectedValue);

    if (optionToSelect) {
      // Imposta la select sul valore corrispondente
      selector.value = optionToSelect.value;
      selector.dispatchEvent(new Event('change', { bubbles: true }));

      foundMatch = true;
    }
  });

  // Se non abbiamo trovato corrispondenze in nessun select, logghiamo un avviso
  if (!foundMatch) {
    console.log("Nessuna corrispondenza trovata in .RB_Addon_Wrapper; nessuna modifica eseguita.");
  }

  // Se siamo arrivati qui, la sezione esiste, quindi restituiamo comunque true.
  return true;
}

// Attiva un MutationObserver per monitorare l'aggiunta della sezione o delle select
/**
 * @param {string} selectedValue
 */
function attachMutationObserver(selectedValue) {
  const observer = new MutationObserver(function(mutations, obs) {
    // Ogni volta che ci sono modifiche nel DOM, riproviamo a sincronizzare
    if (syncRBPCSelect(selectedValue)) {
      // Se ora la sincronizzazione è andata a buon fine, interrompiamo l'osservazione
      obs.disconnect();
    }
  });
  // Osserviamo il body per modifiche (inclusi i nodi aggiunti in profondità)
  observer.observe(document.body, { childList: true, subtree: true });
}

// Listener per quando cambia la dimensione nei radio di .swatch-group
document.addEventListener('change', function (event) {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;
  // Verifica che l'evento provenga da un input radio all'interno di .swatch-group
  if (target.matches('.swatch-group input[type="radio"]')) {
    const selectedValue = target.value.trim();
    console.log("Dimensione selezionata:", selectedValue);

    // Tenta la sincronizzazione
    if (!syncRBPCSelect(selectedValue)) {
      // Se la sezione non è ancora presente, attiva un MutationObserver
      attachMutationObserver(selectedValue);
    }
  }
});

// All'avvio della pagina, controlliamo se ci sono radio già selezionati
document.addEventListener('DOMContentLoaded', function() {
  const checkedRadio = document.querySelector('.swatch-group input[type="radio"]:checked');
  if (checkedRadio instanceof HTMLInputElement) {
    const selectedValue = checkedRadio.value.trim();
    console.log("Dimensione selezionata (load):", selectedValue);

    if (!syncRBPCSelect(selectedValue)) {
      attachMutationObserver(selectedValue);
    }
  }

});


/*
// Funzione che aggiunge il listener di click
// a tutti i .RB_Product_List presenti nel DOM.
function attachMediaClickHandler() {
  const productLists = document.querySelectorAll('.RB_Product_List');
  
  // Se non troviamo alcun elemento .RB_Product_List,
  // restituiamo false perché potrebbe significare
  // che non è ancora stata caricata la sezione nel DOM.
  if (productLists.length === 0) {
    return false;
  }

  productLists.forEach(list => {
    // Per evitare di attaccare più volte l'handler
    // allo stesso elemento, usiamo un attributo custom.
    if (!list.hasAttribute('data-handler-attached')) {
      list.addEventListener('click', (e) => {

        const thisCard = list.querySelector('.RB_Product_Card');
        //if (!thisCard) return;

        console.log('list');
        //const selectedCards = document.querySelectorAll('.RB_Product_Card[data-status="true"]');
    //     selectedCards.forEach(card => {
      //     if (card !== thisCard) {
       //      const mediaElement = card.querySelector('.RB_PC_Media');
        //     console.log(mediaElement);
         //    if (mediaElement) {
          //     mediaElement.click();
         //    }
            
           
          }
   //     });
        
        
        // Al click sul container, triggeriamo il click
        // sul suo figlio .RB_PC_Media (se presente).
        const mediaElement = list.querySelector('.RB_PC_Media');
        if (mediaElement) {
          mediaElement.click();
        }
      });

      // Segniamo che abbiamo già aggiunto il listener
      list.setAttribute('data-handler-attached', 'true');
    }
  });

  // Se siamo arrivati qui significa che abbiamo trovato
  // almeno un .RB_Product_List. Restituiamo true.
  return true;
}

// Funzione che crea il MutationObserver e
// osserva il body per modifiche nel subtree.
function attachMutationObserverForMediaClick() {
  const observer = new MutationObserver((mutations, obs) => {
    // Ogni volta che il DOM cambia, riproviamo
    // ad agganciare il listener.
    if (attachMediaClickHandler()) {
      // Se finalmente riusciamo ad agganciare i listener,
      // possiamo scollegare l’osservazione (se desiderato).
      obs.disconnect();
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

// Avviamo tutto quando il DOM è carico.
document.addEventListener('DOMContentLoaded', function() {
    // Controllo preliminare: se non esiste .wcpb_ao_section nel DOM, esco
  const wcpbSection = document.querySelector('.wcpb_ao_section');
  if (!wcpbSection) {
    return;
  }
  
  // Se attachMediaClickHandler non trova
  // nessun .RB_Product_List, allora avviamo
  // il MutationObserver.
  if (!attachMediaClickHandler()) {
    attachMutationObserverForMediaClick();
  }
});
*/

