const newProductAdd = document.querySelector("#addBenefits")
const newProductBenefits = document.querySelector("#addProductBenefits")

function removeInput() {
    this.parentElement.remove();
}

function addInput(div) {
    const image = document.createElement("input");
    image.type = "text";
    image.placeholder = "Imagem";
    image.id = "benefitImage";

    const texto = document.createElement("input");
    texto.type = "text";
    texto.placeholder = "Texto";
    texto.id = "benefitText";

    const btn = document.createElement("a");
    btn.className = "delete";
    btn.innerHTML = "&times";

    btn.addEventListener("click", removeInput)

    const flex = document.createElement("div");
    flex.className = "flex";

    flex.appendChild(image)
    flex.appendChild(texto)
    flex.appendChild(btn)
    div.appendChild(flex)
}

function addInputsEdit(benefits) {
    const editProductBenefits = document.querySelector("#editProductBenefits")
    editProductBenefits.innerHTML = ""

    benefits.forEach(benefit => {
        const {image, name} = benefit

        const imageInput = document.createElement("input");
        imageInput.type = "text";
        imageInput.placeholder = "Imagem";
        imageInput.id = "benefitImage";
        imageInput.value = image

        const textInput = document.createElement("input");
        textInput.type = "text";
        textInput.placeholder = "Texto";
        textInput.id = "benefitText";
        textInput.value = name

        const btn = document.createElement("a");
        btn.className = "delete";
        btn.innerHTML = "&times";

        btn.addEventListener("click", removeInput)

        const flex = document.createElement("div");
        flex.className = "flex";

        flex.appendChild(imageInput)
        flex.appendChild(textInput)
        flex.appendChild(btn)
        editProductBenefits.appendChild(flex)
    })
}

newProductAdd.addEventListener("click", () => addInput(newProductBenefits))