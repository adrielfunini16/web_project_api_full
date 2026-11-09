import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { useState, useEffect, useCallback, useRef } from "react";
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
  const [jwt, setJwt] = useState(getToken);
  const [isAuthLoading, setIsAuthLoading] = useState(() => Boolean(jwt));
  const [authUser, setAuthUser] = useState(null);
  const [infoTooltip, setInfoTooltip] = useState(null);
  const authAttempt = useRef(0);

  const showError = useCallback((error) => {
    setInfoTooltip({ isSuccess: false, message: error.message });
  }, []);

  const handleLogout = useCallback(() => {
    authAttempt.current += 1;
    removeToken();
    setJwt(null);
    setIsLoggedIn(false);
    setIsAuthLoading(false);
    setAuthUser(null);
    setCurrentUser({});
    setCards([]);
    setPopup(null);
    setInfoTooltip(null);
    navigate("/signin");
  }, [navigate]);

  const handleApiError = useCallback((error) => {
    if (error.status === 401) handleLogout();
    showError(error);
  }, [handleLogout, showError]);

  const handleAuthSuccess = useCallback((user) => {
    setAuthUser(user);
    setCurrentUser(user);
    setIsLoggedIn(true);
    navigate("/");
  }, [navigate]);

  const handleRegister = (userData) => {
    register(userData)
      .then(() => {
        setInfoTooltip({ isSuccess: true });
        navigate("/signin");
      })
      .catch(showError);
  };

  const handleLogin = async (userData) => {
    const attempt = ++authAttempt.current;
    try {
      const { token } = await authenticate(userData);
      const user = await checkToken(token);
      if (attempt !== authAttempt.current) return;
      setToken(token);
      setJwt(token);
      handleAuthSuccess(user);
    } catch (error) {
      if (attempt === authAttempt.current) showError(error);
    }
  };

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    let active = true;
    const attempt = authAttempt.current;
    checkToken(token)
      .then((user) => {
        if (active && attempt === authAttempt.current && getToken() === token) {
          setJwt(token);
          handleAuthSuccess(user);
        }
      })
      .catch((error) => {
        if (!active || attempt !== authAttempt.current || getToken() !== token) return;
        if (error.status === 401 || error.status === 404) handleLogout();
        showError(error);
      })
      .finally(() => {
        if (active) setIsAuthLoading(false);
      });
    return () => { active = false; };
  }, [handleAuthSuccess, handleLogout, showError]);

  useEffect(() => {
    if (!isLoggedIn || !jwt) return;
    let active = true;
    const token = getToken();
    api.getAppInfo()
      .then(([userData, cardsData]) => {
        if (!active || getToken() !== token) return;
        setCurrentUser(userData);
        setAuthUser(userData);
        setCards(
          [...cardsData].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
        );
      })
      .catch((error) => {
        if (active && getToken() === token) handleApiError(error);
      });
    return () => { active = false; };
  }, [isLoggedIn, jwt, handleApiError]);

  // Respostas de uma sessão encerrada não devem atualizar a sessão seguinte.
  async function runPrivateAction(operation, onSuccess) {
    const token = getToken();
    try {
      const result = await operation();
      if (getToken() === token) onSuccess(result);
    } catch (error) {
      if (getToken() === token) handleApiError(error);
    }
  }

  function handleCardLike(card) {
    const isLiked = card.likes.includes(currentUser._id);
    return runPrivateAction(
      () => api.changeLikeCardStatus(card._id, !isLiked),
      (newCard) => setCards((state) => state.map((item) => item._id === card._id ? newCard : item)),
    );
  }

  function handleCardDelete(card) {
    return runPrivateAction(
      () => api.cardDelete(card._id),
      () => setCards((state) => state.filter((item) => item._id !== card._id)),
    );
  }

  function handleOpenPopup(popup) {
    setPopup(popup);
  }

  function handleClosePopup() {
    setPopup(null);
  }

  const handleUpdateUser = (data) => runPrivateAction(
    () => api.editProfileData(data),
    (user) => {
      setCurrentUser(user);
      setAuthUser(user);
      handleClosePopup();
    },
  );

  const handleUpdateAvatar = (data) => runPrivateAction(
    () => api.updateAvatar(data),
    (user) => {
      setCurrentUser(user);
      setAuthUser(user);
      handleClosePopup();
    },
  );

  const handleAddPlaceSubmit = (data) => runPrivateAction(
    () => api.addNewCard(data),
    (newCard) => {
      setCards((state) => [newCard, ...state]);
      handleClosePopup();
    },
  );

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
          <Route path="/signin" element={isLoggedIn ? <Navigate to="/" replace /> : <Login handleLogin={handleLogin} />} />
          <Route
            path="/signup"
            element={isLoggedIn ? <Navigate to="/" replace /> : <Register handleRegister={handleRegister} />}
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
          isSuccess={infoTooltip.isSuccess}
          message={infoTooltip.message}
          onClose={() => setInfoTooltip(null)}
        />
      )}
    </CurrentUserContext.Provider>
  );
}

export default App;
