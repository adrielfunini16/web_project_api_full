import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import CurrentUserContext from "../contexts/CurrentUserContext";
import Header from "./Header/Header";
import Main from "./Main/Main";
import Footer from "./Footer/Footer";
import api from "../utils/api";
import Login from "./Login/Login";
import { authenticate, register, checkToken } from "../utils/auth";
import Register from "./Register/Register";
import { setToken, getToken, removeToken } from "../utils/token";
import ProtectedRoute from "./ProtectedRoute/ProtectedRoute";
import LoadingScreen from "./LoadingScreen/LoadingScreen";
import InfoTooltip from "./InfoTooltip/InfoTooltip";

function App() {
  const navigate = useNavigate();
  const [popup, setPopup] = useState(null);
  const [currentUser, setCurrentUser] = useState({});
  const [cards, setCards] = useState([]);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [authUser, setAuthUser] = useState(null);
  const [infoTooltip, setInfoTooltip] = useState(null);

  const handleRegister = (userData) => {
    register(userData)
      .then(() => {
        setInfoTooltip(true);
        navigate("/signin");
      })
      .catch((err) => {
        setInfoTooltip(false);
        console.error(err.message);
      });
  };

  const handleAuthSuccess = (res) => {
    setAuthUser(res.data);
    setIsLoggedIn(true);
    navigate("/");
  };

  const handleLogin = (userData) => {
    authenticate(userData)
      .then((data) => {
        setToken(data.token);
        return checkToken(data.token);
      })
      .then((res) => {
        handleAuthSuccess(res);
      })
      .catch((err) => {
        console.error(err.message);
        if (err.source === "checkToken") {
          handleLogout();
        }
      });
  };

  const handleLogout = () => {
    removeToken();
    setIsLoggedIn(false);
    setAuthUser(null);
    navigate("/signin");
  };

  useEffect(() => {
    const token = getToken();
    if (!token) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsAuthLoading(false);
      return;
    }
    checkToken(token)
      .then((res) => {
        handleAuthSuccess(res);
      })
      .catch((err) => {
        console.error(err.message);

        if (err.source === "checkToken") {
          handleLogout();
        }
      })
      .finally(() => {
        setIsAuthLoading(false);
      });
  }, []);

  async function handleCardLike(card) {
    const isLiked = card.isLiked;

    await api
      .changeLikeCardStatus(card._id, !isLiked)
      .then((newCard) => {
        setCards((state) =>
          state.map((currentCard) =>
            currentCard._id === card._id ? newCard : currentCard,
          ),
        );
      })
      .catch((error) => console.error(error));
  }

  async function handleCardDelete(card) {
    await api.cardDelete(card._id);
    setCards((state) =>
      state.filter((currentCard) => currentCard._id !== card._id),
    );
  }

  function handleOpenPopup(popup) {
    setPopup(popup);
  }

  function handleClosePopup() {
    setPopup(null);
  }

  useEffect(() => {
    if (!isLoggedIn) {
      return;
    }
    (async () => {
      await api.getAppInfo().then(([userData, cardsData]) => {
        setCurrentUser(userData);
        setCards(cardsData);
      });
    })();
  }, [isLoggedIn]);

  const handleUpdateUser = (data) => {
    (async () => {
      await api
        .editProfileData(data)
        .then((newData) => {
          setCurrentUser(newData);
          handleClosePopup();
        })
        .catch((error) => console.error(error));
    })();
  };

  const handleUpdateAvatar = (data) => {
    (async () => {
      await api
        .updateAvatar(data)
        .then((newData) => {
          setCurrentUser(newData);
          handleClosePopup();
        })
        .catch((error) => console.error(error));
    })();
  };

  const handleAddPlaceSubmit = (data) => {
    (async () => {
      await api
        .addNewCard(data)
        .then((newCard) => {
          setCards([newCard, ...cards]);
          handleClosePopup();
        })
        .catch((error) => console.error(error));
    })();
  };

  return (
    <CurrentUserContext.Provider
      value={{
        currentUser,
        handleUpdateUser,
        handleUpdateAvatar,
        handleAddPlaceSubmit,
      }}
    >
      {isAuthLoading ? (
        <LoadingScreen />
      ) : (
        <Routes>
          <Route path="/signin" element={<Login handleLogin={handleLogin} />} />
          <Route
            path="/signup"
            element={<Register handleRegister={handleRegister} />}
          />
          <Route
            path="/"
            element={
              <ProtectedRoute isLoggedIn={isLoggedIn}>
                <div className="page__content">
                  <Header
                    isLoggedIn={isLoggedIn}
                    handleLogout={handleLogout}
                    authUser={authUser}
                  />
                  <Main
                    onOpenPopup={handleOpenPopup}
                    onClosePopup={handleClosePopup}
                    popup={popup}
                    cards={cards}
                    onCardLike={handleCardLike}
                    onCardDelete={handleCardDelete}
                  />
                  <Footer />
                </div>
              </ProtectedRoute>
            }
          />
          <Route
            path="*"
            element={
              isLoggedIn ? (
                <Navigate to="/" replace />
              ) : (
                <Navigate to="/signin" replace />
              )
            }
          />
        </Routes>
      )}
      {infoTooltip !== null && (
        <InfoTooltip
          isSuccess={infoTooltip}
          onClose={() => setInfoTooltip(null)}
        />
      )}
    </CurrentUserContext.Provider>
  );
}

export default App;
