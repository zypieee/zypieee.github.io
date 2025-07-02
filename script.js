document.getElementById("memberForm").addEventListener("submit", function (e) {
  e.preventDefault();

  const name = document.getElementById("name").value.trim();
  const surname = document.getElementById("surname").value.trim();
  const phone = document.getElementById("phone").value.trim();
  const membershipMonths = parseInt(document.getElementById("membership").value);
  const payment = document.getElementById("payment").value;

  const startDate = new Date();
  const endDate = new Date();
  endDate.setMonth(endDate.getMonth() + membershipMonths);

  const member = {
    name,
    surname,
    phone,
    startDate: startDate.toISOString().split("T")[0],
    endDate: endDate.toISOString().split("T")[0],
    membershipMonths,
    payment
  };

  let members = JSON.parse(localStorage.getItem("members")) || [];
  members.push(member);
  localStorage.setItem("members", JSON.stringify(members));

  this.reset();
  renderMembers();
});

document.getElementById("filter").addEventListener("change", renderMembers);

function renderMembers() {
  const tbody = document.querySelector("#memberTable tbody");
  tbody.innerHTML = "";

  const filter = document.getElementById("filter").value;
  let members = JSON.parse(localStorage.getItem("members")) || [];
  const today = new Date();

  members.forEach((member, index) => {
    const endDate = new Date(member.endDate);
    const isExpired = today > endDate;

    if (filter === "active" && isExpired) return;
    if (filter === "expired" && !isExpired) return;

    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${member.name}</td>
      <td>${member.surname}</td>
      <td>${member.phone}</td>
      <td>${member.startDate}</td>
      <td>${member.endDate}</td>
      <td>${member.membershipMonths} ay</td>
      <td>${member.payment}</td>
      <td style="color:${isExpired ? 'red' : 'green'};">
        ${isExpired ? "Süresi Doldu" : "Aktif"}
      </td>
      <td><button class="delete" onclick="deleteMember(${index})">Sil</button></td>
    `;

    tbody.appendChild(row);
  });
}

function deleteMember(index) {
  let members = JSON.parse(localStorage.getItem("members")) || [];
  members.splice(index, 1);
  localStorage.setItem("members", JSON.stringify(members));
  renderMembers();
}

renderMembers();
