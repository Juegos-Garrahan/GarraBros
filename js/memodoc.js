
/******************************************
 CONFIGURACIÓN DE JUGADORES
******************************************/

const player1Emoji="🧒";
const player2Emoji="👧";

const player1Image="../images/personaje_m.png";
const player2Image="../images/personaje_f.png";

/******************************************
 CARTAS
 Si image está vacío usa el emoji
******************************************/

const cardsData=[

{
icon:"👩‍⚕️",
image:"",
text:"La doctora ayuda a que los niños estén sanos."
},

{
icon:"👩‍⚕️",
image:"",
text:"La doctora ayuda a que los niños estén sanos."
},

{
icon:"👩‍⚕️💙",
image:"../images/logo_garrahan.png",
text:"Las enfermeras cuidan a los niños todos los días."
},

{
icon:"👩‍⚕️💙",
image:"../images/logo_garrahan.png",
text:"Las enfermeras cuidan a los niños todos los días."
},

{
icon:"🧑‍🔬",
image:"",
text:"Los análisis ayudan a conocer mejor tu salud."
},

{
icon:"🧑‍🔬",
image:"",
text:"Los análisis ayudan a conocer mejor tu salud."
},

{
icon:"🩺",
image:"",
text:"Escuchar el corazón ayuda a revisar tu salud."
},

{
icon:"🩺",
image:"",
text:"Escuchar el corazón ayuda a revisar tu salud."
},

{
icon:"🩹",
image:"",
text:"Las curitas ayudan a sanar."
},

{
icon:"🩹",
image:"",
text:"Las curitas ayudan a sanar."
},

{
icon:"❤️",
image:"",
text:"Un corazón sano es una gran noticia."
},

{
icon:"❤️",
image:"",
text:"Un corazón sano es una gran noticia."
},

{
icon:"🏥",
image:"../images/hospital.png",
text:"El hospital es un lugar para ayudarte."
},

{
icon:"🏥",
image:"../images/hospital.png",
text:"El hospital es un lugar para ayudarte."
},

{
icon:"😊",
image:"",
text:"Ser valiente es cuidar tu salud."
},

{
icon:"😊",
image:"",
text:"Ser valiente es cuidar tu salud."
}

];

/******************************************
 AVATARES
******************************************/

document.getElementById("avatar1").innerHTML =
`<img src="${player1Image}"
      class="avatar"
      onerror="this.outerHTML='${player1Emoji}'">`;

document.getElementById("avatar2").innerHTML =
`<img src="${player2Image}"
      class="avatar"
      onerror="this.outerHTML='${player2Emoji}'">`;

/******************************************
 MEZCLAR CARTAS
******************************************/

cardsData.sort(()=>Math.random()-0.5);

const board=document.getElementById("board");

let firstCard=null;
let secondCard=null;
let lock=true;

let currentPlayer=1;
let score1=0;
let score2=0;

cardsData.forEach(cardData=>{

let card=document.createElement("div");

card.className="card flipped";

card.dataset.icon=cardData.icon;
card.dataset.image=cardData.image;
card.dataset.text=cardData.text;

if(cardData.image){
    card.innerHTML=`<img src="${cardData.image}">`;
}
else{
    card.innerHTML=cardData.icon;
}

card.addEventListener("click",flipCard);

board.appendChild(card);

});

/******************************************
 CUENTA REGRESIVA
******************************************/

let seconds=5;

const interval=setInterval(()=>{

document.getElementById("message").innerHTML=
`👀 Memoriza las cartas. Se ocultarán en ${seconds} segundos...`;

seconds--;

if(seconds<0){

clearInterval(interval);

document.querySelectorAll(".card").forEach(card=>{

card.classList.remove("flipped");
card.innerHTML="❓";

});

document.getElementById("message").innerHTML=
"🎮 Comienza Tomi.";

lock=false;

}

},1000);

/******************************************
 JUEGO
******************************************/

function reveal(card){

if(card.dataset.image){

card.innerHTML=
`<img src="${card.dataset.image}">`;

}
else{

card.innerHTML=card.dataset.icon;

}

}

function flipCard(){

if(lock) return;

if(this.classList.contains("matched")) return;

if(this===firstCard) return;

this.classList.add("flipped");

reveal(this);

if(!firstCard){

firstCard=this;
return;

}

secondCard=this;
lock=true;

if(
firstCard.dataset.icon===secondCard.dataset.icon &&
firstCard.dataset.image===secondCard.dataset.image
){

setTimeout(()=>{

firstCard.classList.add("matched");
secondCard.classList.add("matched");

document.getElementById("message").innerHTML=
"✅ "+firstCard.dataset.text;

if(currentPlayer===1){

score1++;
document.getElementById("score1").textContent=score1;

}else{

score2++;
document.getElementById("score2").textContent=score2;

}

resetCards();

if(document.querySelectorAll(".matched").length===16){

finishGame();

}

},600);

}
else{

setTimeout(()=>{

firstCard.classList.remove("flipped");
secondCard.classList.remove("flipped");

firstCard.innerHTML="❓";
secondCard.innerHTML="❓";

changePlayer();

resetCards();

},1000);

}

}

function resetCards(){

firstCard=null;
secondCard=null;
lock=false;

}

function changePlayer(){

currentPlayer=currentPlayer===1?2:1;

document.getElementById("p1").classList.toggle("active");
document.getElementById("p2").classList.toggle("active");

document.getElementById("message").innerHTML=
currentPlayer===1
?
"🎮 Turno de Tomi"
:
"🎮 Turno de Luna";

}

function finishGame(){

    let text="";

    if(score1 > score2){
        text = "🏆 ¡Ganó Tomi!";
    }
    else if(score2 > score1){
        text = "🏆 ¡Ganó Luna!";
    }
    else{
        text = "🤝 ¡Empate!";
    }

    document.getElementById("winnerText").innerHTML = text;
    document.getElementById("winner").style.display = "block";

    lock = true;
}
