const formData = document.getElementById('formData');
const contractTest = document.getElementById('contractTest');
const linka = "http://localhost:3000";
const linkb = "http://localhost:3000/address";

formData.addEventListener('submit', (e)=>{
    e.preventDefault()
    const data = contractTest.value;

    const contract = {
        con : data
    }

    deployContract(linkb, contract)
    contractTest.value = ""

})

const deployContract = async (link, contract) =>{
    const response = await fetch(link, {
        method : "POST",
        body : JSON.stringify(contract),
        headers : {
            'Content-Type': 'application/json'
        }
    });
    const data = await response.json()
    console.log(data);
}

